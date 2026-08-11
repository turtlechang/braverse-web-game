import { describe, expect, it } from 'vitest'
import pFormalDocument from '../../data/cards/official-promotion-p001-p032.en.json'
import pFormalRemainingDocument from '../../data/cards/official-promotion-p001-p032-remaining.en.json'
import pPromotedDocument from '../../data/cards/official-p-0xx-remaining.en.json'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'

const promotedCards = pPromotedDocument.cards as OfficialCardRecord[]
const formalCards = [
  ...pFormalDocument.cards,
  ...pFormalRemainingDocument.cards,
  ...promotedCards,
] as OfficialCardRecord[]
const allPRecords = formalCards

describe('P-0XX official conversion coverage', () => {
  it('keeps the complete official record inventory, including art variants', () => {
    expect(allPRecords).toHaveLength(153)
    expect(promotedCards).toHaveLength(127)
    expect(promotedCards.filter((card) => card.cardNumber.includes('@'))).toHaveLength(14)
    expect(new Set(allPRecords.map((card) => card.cardNumber)).size).toBe(153)
    expect(pPromotedDocument.source.candidateStatus).toBe('promotion-ready')
  })

  it('converts every formal P-0XX record', () => {
    const unsupported = allPRecords
      .map((card) => convertOfficialCardToGameCard(card))
      .filter((conversion) => conversion.status !== 'converted')

    expect(unsupported).toEqual([])
  })

  it('preserves the special trap, item, and Special Play semantics', () => {
    const find = (cardNumber: string) =>
      allPRecords.find((card) => card.cardNumber === cardNumber)!

    const p036 = convertOfficialCardToGameCard(find('P-036@1'))
    expect(p036.status).toBe('converted')
    if (p036.status === 'converted') {
      expect(p036.gameCard.trap).toMatchObject({
        cost: { energy: { red: 3 } },
        effects: [
          { kind: 'damage-all', side: 'self', amount: 1 },
          { kind: 'damage-all', side: 'opponent', amount: 1 },
        ],
      })
    }

    const p031 = convertOfficialCardToGameCard(find('P-031@1'))
    expect(p031.status).toBe('converted')
    if (p031.status === 'converted') {
      expect(p031.gameCard.trap?.effects).toHaveLength(2)
      expect(p031.gameCard.trap?.cost).toMatchObject({ energy: { purple: 2 } })
    }

    const p082 = convertOfficialCardToGameCard(find('P-082'))
    expect(p082.status).toBe('converted')
    if (p082.status === 'converted') {
      expect(p082.gameCard.trap?.effects).toEqual([
        { kind: 'gain-hp', amount: 2, target: { side: 'self', min: 1, max: 1 } },
        { kind: 'gain-hp', amount: 2, target: { side: 'opponent', min: 1, max: 1 } },
      ])
      expect(p082.gameCard.trap?.alternativeCosts).toEqual([
        {
          energy: {},
          trashCookieToBreakArea: {
            count: 1,
            hp: 1,
            excludeFlip: true,
          },
        },
      ])
    }

    const p084 = convertOfficialCardToGameCard(find('P-084'))
    expect(p084.status).toBe('converted')
    if (p084.status === 'converted') {
      expect(p084.gameCard.item?.effects.map((effect) => effect.kind)).toEqual([
        'rest-cookie',
        'damage',
      ])
      expect(p084.gameCard.item?.activationCostOverride).toEqual({
        condition: 'friendly-cookie-fainted-this-turn',
        cost: { energy: { neutral: 1 } },
      })
    }

    const p147 = convertOfficialCardToGameCard(find('P-147'))
    expect(p147.status).toBe('converted')
    if (p147.status === 'converted') {
      expect(p147.gameCard.skill?.cost).toMatchObject({ energy: {}, discardHand: 0 })
      expect(p147.gameCard.skill?.specialPlayCost).toMatchObject({
        energy: {},
        trashBattleCookie: { count: 1, level: 1, energyColor: 'black' },
      })
    }

    const p069 = convertOfficialCardToGameCard(find('P-069'))
    expect(p069.status).toBe('converted')
    if (p069.status === 'converted') {
      expect(p069.gameCard.skill).toMatchObject({
        trigger: 'on-play',
        fromTrashArea: true,
      })
    }
  })
})
