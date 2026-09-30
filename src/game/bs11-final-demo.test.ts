import { describe, expect, it } from 'vitest'
import {
  createBs11032AttackDemoState,
  createBs11032EndTurnDemoState,
  createBs11035AttackDemoState,
  createBs11FlipPreviewDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11 final Browser fixtures', () => {
  it.each(['BS11-032', 'BS11-032@1'] as const)('%s separates attack and end-turn conditions', (cardNumber) => {
    for (const positive of [true, false]) {
      const scenario = positive ? 'positive' : 'negative'
      expect(parseTestStateConfig(`?test-state=bs11-032-attack:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-032-attack', cardNumber, hasOther: positive })
      const attack = createBs11032AttackDemoState(cardNumber, positive)
      expect(attack.players['player-one'].battleArea.some((entry) => entry.card.instanceId === 'bs11-032-other-yellow'))
        .toBe(positive)
      expect(parseTestStateConfig(`?test-state=bs11-032-end-turn:${cardNumber}:${scenario}`, 'localhost'))
        .toEqual({ kind: 'bs11-032-end-turn', cardNumber, playedLevelThree: positive })
      const turn = createBs11032EndTurnDemoState(cardNumber, positive)
      expect(turn.cookieLevelsPlayedFromBreakThisTurn?.['player-one']).toEqual([positive ? 3 : 2])
    }
  })

  it.each(['BS11-035', 'BS11-035@1'] as const)('%s has a FLIP discard only in its positive attack', (cardNumber) => {
    for (const hasFlip of [true, false]) {
      expect(parseTestStateConfig(`?test-state=bs11-035-attack:${cardNumber}:${hasFlip ? 'positive' : 'negative'}`, 'localhost'))
        .toEqual({ kind: 'bs11-035-attack', cardNumber, hasFlip })
      const player = createBs11035AttackDemoState(cardNumber, hasFlip).players['player-one']
      expect(player.hand[0]?.id).toBe(hasFlip ? 'BS11-019' : 'BS11-032')
      expect(player.supportArea).toHaveLength(4)
    }
  })

  it('BS11-071@2 reveals as HP without opening a FLIP decision', () => {
    expect(parseTestStateConfig('?test-state=bs11-071-hp-no-flip', 'localhost'))
      .toEqual({ kind: 'bs11-071-hp-no-flip' })
    const state = createBs11FlipPreviewDemoState('BS11-071@2', false)
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId))
      .toContain('bs11-bs11-071-2-revealed-flip')
    expect(state.pendingBattle?.stage).not.toBe('flip')
  })
})
