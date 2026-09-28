import { describe, expect, it } from 'vitest'
import {
  createBs11FourteenthBatchDemoState,
  parseTestStateConfig,
  type Bs11FourteenthBatchCardNumber,
} from './demo'

const variants: Bs11FourteenthBatchCardNumber[] = [
  'BS11-050', 'BS11-050@1',
  'BS11-051', 'BS11-051@1',
  'BS11-052', 'BS11-052@1',
  'BS11-053', 'BS11-053@1',
]

describe('BS11-050～053 第十四批 Browser fixtures', () => {
  it.each(variants)('%s opens a normal attack route with the intended A/B witness', (cardNumber) => {
    const baseCardNumber = cardNumber.split('@')[0]
    const positive = createBs11FourteenthBatchDemoState(cardNumber, 'positive')
    const negative = createBs11FourteenthBatchDemoState(cardNumber, 'negative')
    const positiveSource = positive.players['player-one'].battleArea[0]
    const negativeSource = negative.players['player-one'].battleArea[0]

    expect(positive.pendingBattle).toBeNull()
    expect(negative.pendingBattle).toBeNull()
    expect(positive.phase).toBe('main')
    expect(positive.activePlayerId).toBe('player-one')
    expect(positiveSource?.card.id).toBe(baseCardNumber)
    expect(negativeSource?.card.id).toBe(baseCardNumber)
    expect(positiveSource?.card.name).toBe(negativeSource?.card.name)
    expect(positive.players['player-one'].supportArea.every(({ card }) => card.energyColor === 'green')).toBe(true)

    if (baseCardNumber === 'BS11-050') {
      expect(positive.players['player-one'].supportArea).toHaveLength(2)
      expect(negative.players['player-one'].supportArea).toHaveLength(3)
      expect(positive.players['player-two'].supportArea).toHaveLength(3)
    } else if (baseCardNumber === 'BS11-051') {
      expect(positive.players['player-one'].supportArea).toHaveLength(7)
      expect(negative.players['player-one'].supportArea).toHaveLength(7)
      expect(positive.players['player-two'].battleArea[0]?.hpCards).toHaveLength(3)
      expect(negative.players['player-two'].battleArea[0]?.hpCards).toHaveLength(4)
    } else if (baseCardNumber === 'BS11-052') {
      expect(positive.players['player-one'].hand).toHaveLength(6)
      expect(positive.players['player-one'].hand[0]).toMatchObject({
        type: 'item',
        energyColor: 'green',
      })
      expect(negative.players['player-one'].hand.every((card) => card.energyColor !== 'green')).toBe(true)
    } else {
      expect(positive.players['player-one'].supportArea).toHaveLength(3)
      expect(negative.players['player-one'].supportArea).toHaveLength(4)
    }
  })

  it.each(variants.filter((cardNumber) => cardNumber.startsWith('BS11-053')))(
    '%s gives Activate routes the exact 5-HP threshold witnesses',
    (cardNumber) => {
      const positive = createBs11FourteenthBatchDemoState(cardNumber, 'activate-positive')
      const negative = createBs11FourteenthBatchDemoState(cardNumber, 'activate-negative')
      expect(positive.players['player-one'].supportArea).toHaveLength(1)
      expect(positive.players['player-two'].battleArea.map(({ hpCards }) => hpCards.length)).toEqual([5, 4])
      expect(negative.players['player-two'].battleArea.map(({ hpCards }) => hpCards.length)).toEqual([4, 4])
    },
  )

  it('parses each variant and rejects Activate routes for cards without that skill', () => {
    for (const cardNumber of variants) {
      expect(parseTestStateConfig(
        `?test-state=bs11-fourteenth-batch:${cardNumber}:positive`,
        'localhost',
      )).toEqual({ kind: 'bs11-fourteenth-batch', cardNumber, scenario: 'positive' })
    }
    expect(parseTestStateConfig(
      '?test-state=bs11-fourteenth-batch:BS11-052@1:activate-positive',
      'localhost',
    )).toBeNull()
  })
})
