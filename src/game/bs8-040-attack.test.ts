import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { resolveBattleAutomatically } from './battle'
import { createBattleState } from './test-helpers/battle-helpers'
import type { GameCard, GameState } from './types'

const official = (id: string, suffix: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const cookie = (id: string, suffix: string) => {
  const card = official(id, suffix)
  if (card.type !== 'cookie') throw new Error(`Expected Cookie ${id}`)
  return card
}

const setup = (breakLevel: 2 | 3 = 3) => {
  const base = createBattleState()
  const attacker = cookie('BS8-040', 'attacker')
  const defender = cookie('BS8-030', 'defender')
  const support = official('BS8-037', 'yellow-support')
  const oldHand = official('BS8-046', 'old-hand')
  const drawnCard = official('BS8-046', 'drawn-card')
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [{ card: defender, hpCards: [official('BS8-046', 'defender-bottom'), official('BS8-046', 'defender-top')], rested: false }],
      },
      'player-two': {
        ...base.players['player-two'],
        battleArea: [{ card: attacker, hpCards: [official('BS8-046', 'attacker-hp')], rested: false }],
        hand: [oldHand],
        deck: [drawnCard, official('BS8-046', 'deck-remaining')],
        supportArea: [{ card: support, rested: false }],
        breakArea: [cookie(breakLevel === 2 ? 'BS8-034' : 'BS8-030', 'break-condition')],
        discardPile: [cookie('BS8-037', 'refresh-cookie'), official('BS8-046', 'trash-item-a'), official('BS8-046', 'trash-item-b')],
      },
    },
  }
  const command = { kind: 'declare-attack' as const, playerId: 'player-two' as const, attackerInstanceId: attacker.instanceId, targetInstanceId: defender.instanceId, supportPaymentIds: [support.instanceId] }
  return { state, attacker, support, oldHand, drawnCard, command }
}

const openAfterAttack = (state: GameState, command: ReturnType<typeof setup>['command']) => {
  const declared = applyGameCommand(state, command)
  expect(declared.players['player-two'].supportArea[0].rested).toBe(true)
  expect(declared.players['player-two'].battleArea[0].rested).toBe(true)
  expect(declared.pendingBattle?.declaredDamage).toBe(1)
  const unblocked = applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' })
  const afterDamage = applyGameCommand(unblocked, { kind: 'resolve-next-damage', playerId: 'player-one' })
  expect(afterDamage.pendingBattle?.stage).toBe('attack-effect')
  return afterDamage
}

const resolveNextEffect = (state: GameState) => applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [] })
const discard = (state: GameState, cardIds: string[]) => applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: 'player-two', cardIds })

describe('BS8-040 compulsory attack draw and discard', () => {
  it('automatic battle resolution waits for the mandatory discard and finishes only after the player chooses', () => {
    const { state, oldHand, drawnCard, command } = setup(3)
    const declared = applyGameCommand(state, command)
    const awaitingDiscard = resolveBattleAutomatically(declared)
    expect(awaitingDiscard.players['player-two'].hand).toEqual([oldHand, drawnCard])
    expect(awaitingDiscard.players['player-two'].deck).toEqual(state.players['player-two'].deck.slice(1))
    expect(awaitingDiscard.pendingBattle).toMatchObject({ stage: 'attack-effect', attackEffectIndex: 1 })
    expect(awaitingDiscard.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-two', count: 1 })
    expect(awaitingDiscard.pendingOpponentHandDiscard?.optional).not.toBe(true)
    expect(resolveBattleAutomatically(awaitingDiscard)).toEqual(awaitingDiscard)
    expect(() => discard(awaitingDiscard, [])).toThrow()
    const resolved = discard(awaitingDiscard, [drawnCard.instanceId])
    expect(resolved.players['player-two'].hand).toEqual([oldHand])
    expect(resolved.players['player-two'].discardPile).toContainEqual(drawnCard)
    expect(resolved.pendingOpponentHandDiscard).toBeFalsy()
    expect(resolved.pendingBattle).toBeNull()
  })

  it('uses the real one-yellow attack and mandatory draw/discard mappings', () => {
    const { state, attacker, command } = setup()
    expect(attacker.attackEnergyCost).toEqual({ yellow: 1 })
    expect(attacker.attackEffects).toEqual([
      { kind: 'draw', amount: 1, condition: { kind: 'break-level-at-least', level: 3 } },
      { kind: 'discard-hand', count: 1, condition: { kind: 'break-level-at-least', level: 3 } },
    ])
    expect(() => applyGameCommand(state, { ...command, supportPaymentIds: [] })).toThrow()
    const wrongColor: GameState = { ...state, players: { ...state.players, 'player-two': {
      ...state.players['player-two'], supportArea: state.players['player-two'].supportArea.map((entry) => ({ ...entry, card: { ...entry.card, energyColor: 'blue' } })),
    } } }
    expect(() => applyGameCommand(wrongColor, command)).toThrow()
    openAfterAttack(state, command)
    expect(state.players['player-two'].supportArea[0].rested).toBe(false)
  })

  it.each(['old', 'drawn'] as const)('at Break LV3 must draw one before discarding the %s hand card', (choice) => {
    const { state, oldHand, drawnCard, command } = setup(3)
    const afterDamage = openAfterAttack(state, command)
    const drawn = resolveNextEffect(afterDamage)
    expect(drawn.players['player-two'].hand).toEqual([oldHand, drawnCard])
    expect(drawn.players['player-two'].deck).toEqual(state.players['player-two'].deck.slice(1))
    expect(drawn.pendingDrawUpTo).toBeFalsy()
    expect(drawn.pendingOptionalCostAttack).toBeFalsy()
    expect(drawn.pendingBattle?.attackEffectIndex).toBe(1)
    expect(() => applyGameCommand(drawn, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 0 })).toThrow()
    const awaitingDiscard = resolveNextEffect(drawn)
    expect(awaitingDiscard.pendingOpponentHandDiscard).toMatchObject({ playerId: 'player-two', count: 1 })
    expect(awaitingDiscard.pendingOpponentHandDiscard?.optional).not.toBe(true)
    expect(() => discard(awaitingDiscard, [])).toThrow()
    const chosen = choice === 'old' ? oldHand : drawnCard
    const resolved = discard(awaitingDiscard, [chosen.instanceId])
    expect(resolved.players['player-two'].hand).toEqual([choice === 'old' ? drawnCard : oldHand])
    expect(resolved.players['player-two'].discardPile).toContainEqual(chosen)
    expect(resolved.pendingBattle).toBeNull()
    expect(resolved.pendingOpponentHandDiscard).toBeFalsy()
  })

  it('at Break LV2 neither draws nor requests a discard', () => {
    const { state, command } = setup(2)
    let result = openAfterAttack(state, command)
    for (let step = 0; step < 2 && result.pendingBattle?.stage === 'attack-effect'; step += 1) {
      result = resolveNextEffect(result)
      expect(result.pendingDrawUpTo).toBeFalsy()
      expect(result.pendingOpponentHandDiscard).toBeFalsy()
    }
    expect(result.pendingBattle).toBeNull()
    expect(result.players['player-two'].hand).toEqual(state.players['player-two'].hand)
    expect(result.players['player-two'].deck).toEqual(state.players['player-two'].deck)
    expect(result.players['player-two'].discardPile).toEqual(state.players['player-two'].discardPile)
  })

  it.each(['unknown', 'wrong-zone', 'duplicate', 'excess'] as const)('rejects %s discard selection', (caseName) => {
    const { state, attacker, oldHand, drawnCard, command } = setup(3)
    const pending = resolveNextEffect(resolveNextEffect(openAfterAttack(state, command)))
    const ids = {
      unknown: ['not-a-card'], 'wrong-zone': [attacker.instanceId],
      duplicate: [oldHand.instanceId, oldHand.instanceId], excess: [oldHand.instanceId, drawnCard.instanceId],
    }[caseName]
    const snapshot = structuredClone(pending)
    expect(() => discard(pending, ids)).toThrow()
    expect(pending).toEqual(snapshot)
  })

  it('retains compulsory discard after drawing the last deck card triggers Refresh', () => {
    const { state, oldHand, drawnCard, command } = setup(3)
    const shortDeck: GameState = { ...state, players: { ...state.players, 'player-two': { ...state.players['player-two'], deck: [drawnCard] } } }
    const interrupted = resolveNextEffect(openAfterAttack(shortDeck, command))
    expect(interrupted.pendingRefresh?.playerId).toBe('player-two')
    expect(interrupted.players['player-two'].hand).toEqual([oldHand, drawnCard])
    expect(interrupted.pendingDrawUpTo).toBeFalsy()
    const refreshed = applyGameCommand(interrupted, { kind: 'refresh-deck', playerId: 'player-two', cookieInstanceId: 'BS8-037:refresh-cookie', shuffleSeed: 1 })
    expect(refreshed.pendingBattle?.stage).toBe('attack-effect')
    expect(refreshed.pendingBattle?.attackEffectIndex).toBe(1)
    const pending = resolveNextEffect(refreshed)
    expect(pending.pendingOpponentHandDiscard?.count).toBe(1)
    expect(() => discard(pending, [])).toThrow()
    const result = discard(pending, [drawnCard.instanceId])
    expect(result.players['player-two'].hand).toEqual([oldHand])
    expect(result.players['player-two'].discardPile).toContainEqual(drawnCard)
    expect(result.pendingBattle).toBeNull()
  })
})
