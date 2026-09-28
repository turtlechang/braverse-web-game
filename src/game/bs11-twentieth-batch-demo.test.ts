import { describe, expect, it } from 'vitest'
import { applyGameCommand, canActivateStage } from './index'
import {
  createBs11079OnPlayDemoState,
  createBs11080ItemDemoState,
  createBs11081ItemDemoState,
  createBs11082TrapDemoState,
  createBs11083StageDemoState,
  createBs11083ReplacementDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-079 On Play fixture', () => {
  it('offers two discard costs and a purple Cookie in trash', () => {
    expect(parseTestStateConfig('?test-state=bs11-079-on-play:positive', 'localhost'))
      .toEqual({ kind: 'bs11-079-on-play', payable: true })
    const positive = createBs11079OnPlayDemoState(true)
    const negative = createBs11079OnPlayDemoState(false)
    expect(positive.players['player-one'].hand).toHaveLength(3)
    expect(negative.players['player-one'].hand).toHaveLength(2)
    expect(positive.players['player-one'].discardPile[0]?.id).toBe('BS11-074')
  })
})

describe('BS11-082 Trap fixture', () => {
  it.each(['BS11-082', 'BS11-082@1'] as const)('gates the hand discard for %s on a real attack', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-082-trap:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-082-trap', cardNumber, conditionMet: true })
    const positive = createBs11082TrapDemoState(cardNumber, true)
    const negative = createBs11082TrapDemoState(cardNumber, false)
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(positive.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS11-088')).toBe(true)
    expect(negative.players['player-one'].battleArea.some((entry) => entry.card.id === 'BS11-088')).toBe(false)
    expect(positive.players['player-two'].hand).toHaveLength(1)
  })
})

describe('BS11-083 Stage fixture', () => {
  it('crosses the Refresh gate while retaining two separate purple payments', () => {
    expect(parseTestStateConfig('?test-state=bs11-083-stage:positive', 'localhost'))
      .toEqual({ kind: 'bs11-083-stage', conditionMet: true })
    const positive = createBs11083StageDemoState(true)
    const negative = createBs11083StageDemoState(false)
    expect(positive.refreshedDuringGame?.['player-one']).toBe(true)
    expect(negative.refreshedDuringGame?.['player-one']).toBe(false)
    expect(positive.players['player-one'].supportArea).toHaveLength(2)
    for (const fixture of [positive, negative]) {
      const stage = fixture.players['player-one'].hand[0]!
      const payment = fixture.players['player-one'].supportArea[0]!.card
      const placed = applyGameCommand(fixture, {
        kind: 'play-stage', playerId: 'player-one', instanceId: stage.instanceId,
        paymentIds: [payment.instanceId],
      })
      expect(canActivateStage(placed, 'player-one')).toBe(true)
    }
  })

  it('exposes the resulting opponent On Play replacement only after Refresh', () => {
    expect(parseTestStateConfig('?test-state=bs11-083-replacement:negative', 'localhost'))
      .toEqual({ kind: 'bs11-083-replacement', conditionMet: false })
    const positive = createBs11083ReplacementDemoState(true)
    const negative = createBs11083ReplacementDemoState(false)
    expect(positive.onPlayReplacementUntilTurn?.['player-one']).toBeDefined()
    expect(negative.onPlayReplacementUntilTurn?.['player-one']).toBeUndefined()
    expect(positive.players['player-one'].hand[0]?.name).toBe('Catacombs On Play Witness')
    expect(positive.players['player-two'].hand).toHaveLength(1)
  })
})

describe('BS11-080 Refresh fixture', () => {
  it('crosses the two-Refresh condition', () => {
    expect(parseTestStateConfig('?test-state=bs11-080-item:negative', 'localhost'))
      .toEqual({ kind: 'bs11-080-item', conditionMet: false })
    const positive = createBs11080ItemDemoState(true)
    const negative = createBs11080ItemDemoState(false)
    expect(positive.refreshCountDuringGame?.['player-one']).toBe(2)
    expect(negative.refreshCountDuringGame?.['player-one']).toBe(1)
    expect(positive.players['player-one'].supportArea).toEqual(negative.players['player-one'].supportArea)
  })
})

describe('BS11-081 shuffle fixture', () => {
  it('preserves both trash piles while crossing the 2P payment', () => {
    expect(parseTestStateConfig('?test-state=bs11-081-item:positive', 'localhost'))
      .toEqual({ kind: 'bs11-081-item', payable: true })
    const positive = createBs11081ItemDemoState(true)
    const negative = createBs11081ItemDemoState(false)
    expect(positive.players['player-one'].discardPile).toHaveLength(2)
    expect(positive.players['player-two'].discardPile).toHaveLength(2)
    expect(positive.players['player-one'].supportArea).toHaveLength(2)
    expect(negative.players['player-one'].supportArea).toHaveLength(1)
  })
})
