import { describe, expect, it } from 'vitest'
import candidateDataset from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const candidateCards = candidateDataset.cards as OfficialCardRecord[]

const findCandidate = (cardNumber: string): OfficialCardRecord => {
  const card = candidateCards.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate ${cardNumber}`)
  return card
}

describe('BS11-016 candidate adapter', () => {
  it.each(['BS11-016', 'BS11-016@1'])(
    'converts %s as an activate skill with a cross-Cookie HP cost',
    (cardNumber) => {
      const card = findCandidate(cardNumber)

      expect(convertOfficialCardEffects(card)).toEqual({
        status: 'supported',
        cardNumber,
        sourceText: card.skill.text,
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
      })
      expect(convertOfficialCookieSkill(card)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: {
          energy: {},
          discardHand: 0,
          hpToTrash: {
            amount: 2,
            energyColor: 'red',
            totalAcrossCookies: true,
          },
        },
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
      })
    },
  )
})
