import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { resolveNextDamage } from './battle'
import inventory from '../../data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json'

const variants = inventory.cards.filter(card => card.baseCardNumber === 'BS8-027').map(card => card.cardNumber)
const setup = (number: string) => {
  let state = createCardCheckDemoState(number)
  const opponent = state.players['player-two'].battleArea[0]
  expect(state.players['player-two'].battleArea).toHaveLength(2)
  const hpIds = state.players['player-two'].battleArea.flatMap(cookie => cookie.hpCards.map(card => card.instanceId))
  expect(new Set(hpIds).size).toBe(hpIds.length)
  const extra = state.players['player-one'].extraDeck![0]
  const awakened = applyGameCommand(state, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: extra.instanceId })
  const source = awakened.players['player-one'].battleArea[0]
  const command = { kind: 'declare-attack' as const, playerId: 'player-one' as const,
    attackerInstanceId: source.card.instanceId, targetInstanceId: opponent.card.instanceId,
    supportPaymentIds: awakened.players['player-one'].supportArea.map(support => support.card.instanceId) }
  state = applyGameCommand(awakened, command)
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; i < 12 && state.pendingBattle?.stage === 'damage'; i++) state = resolveNextDamage(state)
  expect(state.pendingBattle?.stage).toBe('attack-effect')
  return { state, awakened, command, source }
}

describe('BS8-027 Awaken attack and ordered Then damage', () => {
  it.each(variants)('%s pays YYY for 3 damage, then lets the player choose every opponent in order', number => {
    const { state, source } = setup(number)
    expect(source.hpCards).toHaveLength(6)
    expect(source.card.attackEffects).toEqual([{ kind: 'damage-all', amount: 1, side: 'opponent', sequential: true,
      target: { side: 'opponent', min: 0, max: 2 } }])
    const [first, second] = state.players['player-two'].battleArea
    expect(first.hpCards).toHaveLength(3)
    expect(second.hpCards).toHaveLength(6)
    expect(state.players['player-one'].supportArea.every(support => support.rested)).toBe(true)
    const before = structuredClone(state)
    const resolve = (targetIds: string[]) => applyGameCommand(state, {
      kind: 'resolve-attack-effect', playerId: 'player-one', targetIds,
    })
    for (const ids of [[], [first.card.instanceId], [first.card.instanceId, first.card.instanceId],
      [first.card.instanceId, source.card.instanceId]]) expect(() => resolve(ids)).toThrow()
    let result = resolve([second.card.instanceId, first.card.instanceId])
    expect(result.pendingBattle).toMatchObject({ damageTargetInstanceId: second.card.instanceId,
      effectDamageSequence: { remainingTargetInstanceIds: [first.card.instanceId], continuation: 'attack-effect' } })
    for (let i = 0; i < 12 && result.pendingBattle; i++) result = resolveNextDamage(result)
    expect(result.pendingBattle).toBeNull()
    expect(result.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 5])
    expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(6)
    expect(state).toEqual(before)
  })

  it('rejects wrong colour, missing and duplicate attack payment before damaging either target', () => {
    const { awakened, command } = setup('BS8-027')
    awakened.players['player-one'].supportArea[0].card.energyColor = 'red'
    const before = structuredClone(awakened)
    for (const supportPaymentIds of [[], command.supportPaymentIds.slice(0, 2),
      [command.supportPaymentIds[1], command.supportPaymentIds[1], command.supportPaymentIds[2]], command.supportPaymentIds]) {
      expect(() => applyGameCommand(awakened, { ...command, supportPaymentIds })).toThrow()
      expect(awakened).toEqual(before)
    }
  })

  it('does not require or damage an opponent protected from effect damage', () => {
    const { state } = setup('BS8-027')
    const [first, second] = state.players['player-two'].battleArea
    state.effectDamagePreventedUntilTurn = { [second.card.instanceId]: state.turnNumber }
    let result = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [first.card.instanceId] })
    for (let i = 0; i < 12 && result.pendingBattle; i++) result = resolveNextDamage(result)
    expect(result.pendingBattle).toBeNull()
    expect(result.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 6])
  })
})
