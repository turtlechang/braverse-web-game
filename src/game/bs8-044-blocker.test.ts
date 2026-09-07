import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { getCardPoolEntry } from './card-pool'
import { applyGameCommand } from './commands'
import { getBlockerCandidates } from './battle'
import { createBattleState } from './test-helpers/battle-helpers'
import type { CookieCard, GameCard, GameState } from './types'

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

const inBattle = (card: CookieCard, rested = false) => ({ card, rested,
  hpCards: Array.from({ length: card.hp }, (_, index) => official('BS8-046', `${card.instanceId}-hp-${index}`)),
})

const setup = (rested = false) => {
  const base = createBattleState()
  const source = cookie('BS8-044', 'blocker')
  const original = cookie('BS8-039', 'original-target')
  const attackers = [cookie('BS8-036', 'attacker-one'), cookie('BS8-036', 'attacker-two')]
  const supports = [official('BS8-037', 'block-pay-one'), official('BS8-037', 'block-pay-two')]
  const attackSupports = [official('BS8-037', 'attack-pay-one'), official('BS8-037', 'attack-pay-two')]
  const state: GameState = { ...base, players: { ...base.players,
    'player-one': { ...base.players['player-one'], battleArea: [inBattle(source, rested), inBattle(original)], hand: [], supportArea: supports.map((card) => ({ card, rested: false })) },
    'player-two': { ...base.players['player-two'], battleArea: attackers.map((card) => inBattle(card)), supportArea: attackSupports.map((card) => ({ card, rested: false })) },
  } }
  const attack = (index: number) => ({ kind: 'declare-attack' as const, playerId: 'player-two' as const, attackerInstanceId: attackers[index].instanceId, targetInstanceId: original.instanceId, supportPaymentIds: [attackSupports[index].instanceId] })
  const block = (index = 0) => ({ kind: 'play-blocker' as const, playerId: 'player-one' as const, sourceInstanceId: source.instanceId, paymentIds: [supports[index].instanceId] })
  const declared = applyGameCommand(state, attack(0))
  expect(declared.pendingBattle).toMatchObject({ stage: 'trap', targetInstanceId: original.instanceId, declaredDamage: 1 })
  return { state, source, original, declared, attack, block }
}

const finishDamage = (state: GameState) => {
  let next = state
  for (let step = 0; step < 4 && next.pendingBattle?.stage === 'damage'; step += 1) {
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-one' })
  }
  expect(next.pendingBattle).toBeFalsy()
  return next
}

describe('BS8-044 Pistachio Blocker', () => {
  it.each([false, true])('redirects to the actual Blocker for Y1 with rested source=%s', (rested) => {
    const { state, source, original, declared, block } = setup(rested)
    expect(source.attackEnergyCost).toEqual({ yellow: 3 })
    expect(source.attack).toBe(2)
    expect(source.skill).toMatchObject({ trigger: 'block', oncePerTurn: false, restSource: false, cost: { energy: { yellow: 1 } }, effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }] })
    expect(getBlockerCandidates(declared, 'player-one').map((entry) => entry.card.instanceId)).toEqual([source.instanceId])
    const redirected = applyGameCommand(declared, block())
    expect(redirected.pendingBattle).toMatchObject({ stage: 'damage', targetInstanceId: source.instanceId, remainingDamage: 1 })
    expect(redirected.players['player-one'].supportArea.map((entry) => entry.rested)).toEqual([true, false])
    const result = finishDamage(redirected)
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === original.instanceId)).toEqual(state.players['player-one'].battleArea[1])
    const blocker = result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)!
    expect(blocker.hpCards).toHaveLength(source.hp - 1)
    expect(blocker.rested).toBe(rested)
    expect(result.players['player-one'].discardPile).toContainEqual(state.players['player-one'].battleArea[0].hpCards.at(-1))
  })

  it.each(['missing', 'red', 'rested'] as const)('has no payable Blocker with %s energy and rejects payment', (scenario) => {
    const { declared, block } = setup()
    const support = official(scenario === 'red' ? 'BS8-009' : 'BS8-037', 'invalid-pay')
    const state: GameState = { ...declared, players: { ...declared.players, 'player-one': { ...declared.players['player-one'], supportArea: scenario === 'missing' ? [] : [{ card: support, rested: scenario === 'rested' }] } } }
    expect(getBlockerCandidates(state, 'player-one')).toEqual([])
    expect(() => applyGameCommand(state, { ...block(), paymentIds: scenario === 'missing' ? [] : [support.instanceId] })).toThrow()
    expect(state.pendingBattle).toEqual(declared.pendingBattle)
    expect(state.players['player-one'].battleArea).toEqual(declared.players['player-one'].battleArea)
  })

  it('declines in the shared Trap/Blocker response window without paying or redirecting', () => {
    const { state, declared, source, original } = setup()
    const skipped = applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' })
    expect(skipped.pendingBattle).toMatchObject({ stage: 'damage', targetInstanceId: original.instanceId })
    const result = finishDamage(skipped)
    expect(result.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea)
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)).toEqual(state.players['player-one'].battleArea[0])
    expect(result.players['player-one'].battleArea.find((entry) => entry.card.instanceId === original.instanceId)?.hpCards).toHaveLength(original.hp - 1)
  })

  it('rejects the wrong player, no battle, damage timing, and the already-selected target', () => {
    const { state, declared, source, attack, block } = setup()
    expect(getBlockerCandidates(declared, 'player-two')).toEqual([])
    expect(() => applyGameCommand(declared, { ...block(), playerId: 'player-two' })).toThrow()
    expect(() => applyGameCommand(state, block())).toThrow()
    const skipped = applyGameCommand(declared, { kind: 'skip-trap', playerId: 'player-one' })
    expect(getBlockerCandidates(skipped, 'player-one')).toEqual([])
    expect(() => applyGameCommand(skipped, block())).toThrow()
    const directlyAttacked = applyGameCommand(state, { ...attack(0), targetInstanceId: source.instanceId })
    expect(getBlockerCandidates(directlyAttacked, 'player-one')).toEqual([])
    expect(() => applyGameCommand(directlyAttacked, block())).toThrow()
  })

  it('can pay a fresh Y1 to block a second real attack in the same turn', () => {
    const { state, declared, source, original, attack, block } = setup(true)
    const first = finishDamage(applyGameCommand(declared, block(0)))
    expect(first.players['player-two'].battleArea.map((entry) => entry.rested)).toEqual([true, false])
    const secondAttack = applyGameCommand(first, attack(1))
    expect(secondAttack.turnNumber).toBe(state.turnNumber)
    expect(getBlockerCandidates(secondAttack, 'player-one').map((entry) => entry.card.instanceId)).toEqual([source.instanceId])
    const second = finishDamage(applyGameCommand(secondAttack, block(1)))
    expect(second.players['player-one'].supportArea.every((entry) => entry.rested)).toBe(true)
    expect(second.players['player-one'].battleArea.find((entry) => entry.card.instanceId === original.instanceId)).toEqual(state.players['player-one'].battleArea[1])
    expect(second.players['player-one'].battleArea.find((entry) => entry.card.instanceId === source.instanceId)?.hpCards).toHaveLength(source.hp - 2)
  })
})
