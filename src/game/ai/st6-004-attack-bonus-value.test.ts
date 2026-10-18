import { describe, expect, it } from 'vitest'
import {
  canActivateCookieSkill,
  createCustomDeckMatch,
  getActingPlayerId,
  getAttackDamageAgainst,
  getLegalTurnCommands,
  replayCommands,
  takeAiStep,
  type AiStrategyMemory,
  type CookieInBattle,
  type GameCard,
  type GameCommand,
  type GameState,
  type SwissRosterDeck,
} from '..'
import { COMMUNITY_DECK_PRESETS } from '../community-deck-recipes'
import spentAttackFixture from './fixtures/st6-004-spent-attack-command-log.json'

const communityDeck = (
  choice: 'cookierift-1295' | 'cookierift-1239',
): SwissRosterDeck => {
  const recipe = COMMUNITY_DECK_PRESETS[choice]
  return {
    id: choice,
    name: recipe.name,
    entries: recipe.entries,
    extraDeckEntries: recipe.extraDeckEntries,
    color: choice === 'cookierift-1295' ? 'red' : 'yellow',
    format: 'standard',
    createdAt: '2026-10-17',
    updatedAt: '2026-10-17',
  }
}

const mainInventory = (state: GameState, playerId: 'player-one' | 'player-two'): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck, ...player.hand, ...player.discardPile, ...player.breakArea,
    ...player.supportArea.map(support => support.card),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

// Prepared positive control: rearrange the two real 60-card recipes without
// changing printed cards, duplicating instances, or manufacturing HP resources.
const availableAttackState = (): GameState => {
  const initial = createCustomDeckMatch(206129620,
    communityDeck('cookierift-1295'), communityDeck('cookierift-1239'), 'player-one')
  const own = mainInventory(initial, 'player-one')
  const foe = mainInventory(initial, 'player-two')
  const take = (pool: GameCard[], id: string): GameCard => {
    const index = pool.findIndex(card => card.id === id)
    if (index === -1) throw new Error(`Missing real recipe card ${id}`)
    return pool.splice(index, 1)[0]
  }
  const cookie = (pool: GameCard[], card: GameCard, rested: boolean): CookieInBattle => {
    if (card.type !== 'cookie') throw new Error(`${card.id} must be a printed Cookie`)
    return { card, hpCards: pool.splice(0, card.hp), rested }
  }
  const source = take(own, 'ST6-004')
  const ally = take(own, 'BS6-008')
  const hand = [take(own, 'ST1-004')]
  const supportArea = [1, 2, 3].map(() => ({ card: take(own, 'BS1-022'), rested: false }))
  const targetIndex = foe.findIndex(card => card.type === 'cookie' && card.hp === 4)
  if (targetIndex === -1) throw new Error('The opponent recipe must contain a real 4 HP Cookie')
  const target = foe.splice(targetIndex, 1)[0]
  const battleArea = [cookie(own, source, false), cookie(own, ally, true)]
  const opponentBattle = [cookie(foe, target, false)]
  return {
    ...initial, phase: 'main', turnNumber: 3,
    players: {
      ...initial.players,
      'player-one': { ...initial.players['player-one'], deck: own, hand, battleArea, supportArea },
      'player-two': { ...initial.players['player-two'], deck: foe, hand: [], battleArea: opponentBattle, supportArea: [] },
    },
  }
}

describe('AI values temporary self attack bonuses only while they can be used', () => {
  it('keeps the buff available when the source still has a legal attack', () => {
    const state = availableAttackState()
    const playerId = 'player-one'
    const source = state.players[playerId].battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    expect(source.card).toMatchObject({
      id: 'ST6-004', name: 'Pitaya Dragon Cookie', level: 2, hp: 4, attack: 3, energyColor: 'red',
      attackCost: 3, attackEnergyCost: { red: 3 },
      skill: { trigger: 'activate', oncePerTurn: true, cost: { energy: {}, discardHand: 1 } },
    })
    expect(source.hpCards).toHaveLength(4)
    for (const owner of ['player-one', 'player-two'] as const) {
      const initial = createCustomDeckMatch(206129620,
        communityDeck('cookierift-1295'), communityDeck('cookierift-1239'), 'player-one')
      expect(mainInventory(state, owner).map(card => card.instanceId).sort())
        .toEqual(mainInventory(initial, owner).map(card => card.instanceId).sort())
      expect(mainInventory(state, owner)).toHaveLength(60)
    }
    expect(getAttackDamageAgainst(state, source.card.instanceId, target.card.instanceId)).toBe(3)
    expect(getLegalTurnCommands(state, playerId).some(command =>
      command.kind === 'attack' && command.attackerInstanceId === source.card.instanceId,
    )).toBe(true)

    const handBefore = state.players[playerId].hand.map(card => card.instanceId)
    const decision = takeAiStep(state, playerId, {
      level: 5,
      seed: 206129620,
      searchNow: () => 0,
    })

    expect(decision.action).toBe('activate-skill')
    expect(decision.state.players[playerId].hand).toHaveLength(handBefore.length - 1)
    expect(decision.state.players[playerId].discardPile.map(card => card.instanceId)).toContain(handBefore[0])
    expect(getAttackDamageAgainst(decision.state, source.card.instanceId, target.card.instanceId)).toBe(4)
    expect(getLegalTurnCommands(decision.state, playerId).some(command =>
      command.kind === 'attack' && command.attackerInstanceId === source.card.instanceId,
    )).toBe(true)
  })

  it('does not discard for ST6-004 after its attack and all attack opportunities are spent', () => {
    const seed = 206129620
    const left = communityDeck('cookierift-1295')
    const right = communityDeck('cookierift-1239')
    expect(left.entries).toEqual(spentAttackFixture.recipes.left.entries)
    expect(right.entries).toEqual(spentAttackFixture.recipes.right.entries)
    expect(spentAttackFixture.provenance.seed).toBe(seed)
    expect(spentAttackFixture.provenance.commandCount).toBe(spentAttackFixture.commands.length)
    // Commands, rather than AI-step offsets, preserve the original formal game
    // frame even when unrelated AI no-op decisions disappear.
    let state = replayCommands(createCustomDeckMatch(seed, left, right, 'player-one'),
      spentAttackFixture.commands as GameCommand[], { shuffleSeed: seed })
    const memories: Partial<Record<'player-one' | 'player-two', AiStrategyMemory>> = {
      ...spentAttackFixture.memories as unknown as Partial<Record<'player-one' | 'player-two', AiStrategyMemory>>,
    }
    expect(getActingPlayerId(state)).toBe('player-one')
    expect(state.turnNumber).toBe(13)
    expect(state.phase).toBe('main')
    const player = state.players['player-one']
    const source = player.battleArea.find(cookie => cookie.card.id === 'ST6-004')!
    expect(source.card).toMatchObject({ id: 'ST6-004', hp: 4, attack: 3, attackCost: 3, attackEnergyCost: { red: 3 } })
    expect(source.rested).toBe(true)
    expect(player.hand.length).toBeGreaterThan(0)
    expect(source.card.skill?.cost.discardHand).toBe(1)
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    expect(getLegalTurnCommands(state, 'player-one').map(command => command.kind)).toEqual(['advance-phase'])
    const handBefore = player.hand.map(card => card.instanceId)
    expect(handBefore).toEqual(spentAttackFixture.frame.players['player-one'].hand)
    const decision = takeAiStep(state, 'player-one', { level: 5, seed, searchNow: () => 0, memory: memories['player-one'] })
    expect(decision.action).toBe('advance-phase')
    expect(decision.state.players['player-one'].hand.map(card => card.instanceId)).toEqual(handBefore)
    if (decision.reason?.strategyMemory) memories['player-one'] = decision.reason.strategyMemory
    state = decision.state

    for (let index = 0; index < 300 && state.status === 'playing'; index += 1) {
      const playerId = getActingPlayerId(state)

      const next = takeAiStep(state, playerId, {
        level: 5,
        seed,
        searchNow: () => 0,
        memory: memories[playerId],
      })
      if (next.action === 'error' || next.state === state) {
        throw new Error(next.error ?? `No progress before the ST6-004 decision: ${next.description}`)
      }
      if (next.reason?.strategyMemory) memories[playerId] = next.reason.strategyMemory
      state = next.state
    }

    expect(state.status).toBe('finished')
  }, 30000)
})
