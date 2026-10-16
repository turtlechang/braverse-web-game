import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createSt8013PreviewState } from './st8-013-demo'

const begin = (scenario: 'positive' | 'no-wind-archer' | 'opponent-support-rested' | 'no-opponent-support' = 'positive') => {
  const state = createSt8013PreviewState(scenario)
  const item = state.players['player-one'].hand[0]
  const payment = state.players['player-one'].supportArea.find(support =>
    !support.rested && support.card.energyColor === 'green',
  )
  if (!item || item.type !== 'item' || !payment) throw Error('Original Windgrass and active green support required')
  return {
    state: applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item.instanceId,
      paymentIds: [payment.card.instanceId],
    }),
    paymentId: payment.card.instanceId,
  }
}

const resolve = (state: ReturnType<typeof createSt8013PreviewState>, targetIds: string[]) =>
  applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds })

describe('ST8-013 physical Windgrass item parent flow', () => {
  it('pays real G, rests an opponent support, then readies one own support with Wind Archer present', () => {
    const { state: initialState, paymentId } = begin()
    let state = initialState
    const opponentTarget = state.players['player-two'].supportArea[0]
    const ownReadyTarget = state.players['player-one'].supportArea[1]
    expect(state.pendingAbilityEffect?.sourceKind).toBe('item')
    expect(state.pendingAbilityEffect?.effects).toHaveLength(2)

    state = resolve(state, [opponentTarget.card.instanceId])
    expect(state.players['player-two'].supportArea.find(support => support.card.instanceId === opponentTarget.card.instanceId)?.rested)
      .toBe(true)
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)

    state = resolve(state, [ownReadyTarget.card.instanceId])
    expect(state.players['player-one'].supportArea.find(support => support.card.instanceId === ownReadyTarget.card.instanceId)?.rested)
      .toBe(false)
    expect(state.players['player-one'].supportArea.find(support => support.card.instanceId === paymentId)?.rested)
      .toBe(true)
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players['player-one'].discardPile.some(card => card.id === 'ST8-013')).toBe(true)
  })

  it('continues Then after choosing zero opponent supports and permits selecting an already active own support', () => {
    let { state } = begin()
    const activeOwnSupport = state.players['player-one'].supportArea[2]
    state = resolve(state, [])
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(state.players['player-two'].supportArea.every(support => !support.rested)).toBe(true)

    state = resolve(state, [activeOwnSupport.card.instanceId])
    expect(state.players['player-one'].supportArea.find(support => support.card.instanceId === activeOwnSupport.card.instanceId)?.rested)
      .toBe(false)
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  it('keeps the conditional ready effect available when the opponent has no support targets', () => {
    let { state } = begin('no-opponent-support')
    const ownReadyTarget = state.players['player-one'].supportArea[1]
    expect(state.players['player-two'].supportArea).toHaveLength(0)

    state = resolve(state, [])
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
    state = resolve(state, [ownReadyTarget.card.instanceId])
    expect(state.players['player-one'].supportArea.find(support => support.card.instanceId === ownReadyTarget.card.instanceId)?.rested)
      .toBe(false)
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  it('allows the opponent support REST to target a card already rested', () => {
    let { state } = begin('opponent-support-rested')
    const alreadyRested = state.players['player-two'].supportArea[1]
    expect(alreadyRested.rested).toBe(true)
    state = resolve(state, [alreadyRested.card.instanceId])
    expect(state.players['player-two'].supportArea.find(support => support.card.instanceId === alreadyRested.card.instanceId)?.rested)
      .toBe(true)
    expect(state.pendingAbilityEffect?.effectIndex).toBe(1)
  })

  it('keeps the opponent REST but omits only the conditional ready effect without Wind Archer', () => {
    let { state } = begin('no-wind-archer')
    const target = state.players['player-two'].supportArea[0]
    expect(state.players['player-one'].battleArea.some(cookie => cookie.card.name === 'Wind Archer Cookie')).toBe(false)
    expect(state.pendingAbilityEffect?.effects).toHaveLength(1)

    state = resolve(state, [target.card.instanceId])
    expect(state.players['player-two'].supportArea.find(support => support.card.instanceId === target.card.instanceId)?.rested)
      .toBe(true)
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players['player-one'].supportArea[1].rested).toBe(true)
  })

  it('rejects a non-green payment without changing the prepared state', () => {
    const state = createSt8013PreviewState()
    const item = state.players['player-one'].hand[0]
    const wrongColor = state.players['player-one'].supportArea.find(support => support.card.energyColor !== 'green')
    if (!item || !wrongColor) throw Error('Original Item and wrong-color support required')
    const before = structuredClone(state)

    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId,
      paymentIds: [wrongColor.card.instanceId],
    })).toThrow()
    expect(state).toEqual(before)
  })

  it('rejects activation when no active green support can pay and leaves all zones intact', () => {
    const state = createSt8013PreviewState('no-green-payment')
    const item = state.players['player-one'].hand[0]
    if (!item) throw Error('Original Item required')
    const before = structuredClone(state)
    expect(state.players['player-one'].supportArea.every(support => support.rested || support.card.energyColor !== 'green'))
      .toBe(true)

    expect(() => applyGameCommand(state, {
      kind: 'begin-play-item', playerId: 'player-one', instanceId: item.instanceId, paymentIds: [],
    })).toThrow()
    expect(state).toEqual(before)
  })
})
