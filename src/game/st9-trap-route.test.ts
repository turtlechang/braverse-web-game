import { describe, expect, it } from 'vitest'
import { getTrapCandidates } from './battle'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import {
  createSt9TrapPreviewState,
  rawSt9017,
  rawSt9018,
  rawSt9019,
} from './st9-trap-demo'

const cards = [
  ['ST9-017', rawSt9017], ['ST9-018', rawSt9018], ['ST9-019', rawSt9019],
] as const

describe('ST9-017–019 candidate Browser routes', () => {
  it.each(cards)('%s routes its original Trap and negative acceptance path', (cardNumber, raw) => {
    expect(parseTestStateConfig(`?test-state=card:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber })
    expect(parseTestStateConfig(`?test-state=card-negative:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber })
    expect(createCardCheckDemoState(cardNumber)).toEqual(createSt9TrapPreviewState(cardNumber))
    const negative = createCardNegativeDemoState(cardNumber)
    expect(negative.pendingBattle).toMatchObject({ attackerPlayerId: 'player-two', defenderPlayerId: 'player-one', stage: 'trap' })
    expect(negative.players['player-one'].hand[0]).toMatchObject({
      id: cardNumber, name: raw.name, type: 'trap', imageUrl: raw.imageUrl,
    })
    expect(getTrapCandidates(negative, 'player-one').some(card => card.id === cardNumber)).toBe(true)
  })

  it('ST9-017 high-hand negative route keeps BBB legal and blocks only the Then draw', () => {
    const state = createCardNegativeDemoState('ST9-017')
    expect(state.players['player-one'].hand).toHaveLength(5)
    expect(state.players['player-one'].supportArea.filter(support => !support.rested && support.card.energyColor === 'blue')).toHaveLength(3)
  })

  it('ST9-019 negative route keeps a 1-HP Cookie present for the independent Then target filter', () => {
    const state = createCardNegativeDemoState('ST9-019')
    expect(state.players['player-two'].battleArea.find(cookie => cookie.card.id === 'ST4-010')?.hpCards).toHaveLength(1)
    expect(state.players['player-two'].battleArea.find(cookie => cookie.card.id === 'BS1-072')?.hpCards).toHaveLength(4)
  })
})
