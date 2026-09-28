import { describe, expect, it } from 'vitest'
import { createBs11108StageDemoState, parseTestStateConfig } from './demo'

describe('BS11-108 Stage Browser fixtures', () => {
  it.each([true, false])('offers a real %s Special Play prerequisite', (specialPlay) => {
    expect(parseTestStateConfig(`?test-state=bs11-108-stage:${specialPlay ? 'positive' : 'negative'}`, 'localhost'))
      .toEqual({ kind: 'bs11-108-stage', cardNumber: 'BS11-108', specialPlay })
    const state = createBs11108StageDemoState(specialPlay)
    const player = state.players['player-one']
    expect(player.hand.some((card) => card.id === 'BS11-108')).toBe(true)
    expect(player.hand.some((card) => card.id === 'BS11-112')).toBe(specialPlay)
    expect(player.battleArea[0]?.card.energyColor).toBe('black')
    expect(player.supportArea[0]?.card.energyColor).toBe('black')
    expect(state.cookiesPlayedViaSpecialPlayThisTurn?.['player-one']).not.toBe(true)
  })
  it.each(['BS11-108', 'BS11-108@1'] as const)('loads %s as a distinct official image record', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-108-stage:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-108-stage', cardNumber, specialPlay: true })
    expect(createBs11108StageDemoState(true, cardNumber).players['player-one'].hand[0]?.instanceId)
      .toContain(cardNumber)
  })
})
