import { describe, expect, it } from 'vitest'
import bs10CandidateDocument from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs10CandidateDocument.cards as OfficialCardRecord[]
const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS10 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS10-023 candidate adapter', () => {
  it('keeps Wildberry stage removal in the main skill and leaves attack Then pending', () => {
    expect(convertOfficialCardEffects(findCard('BS10-023'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'field-to-trash',
        target: { side: 'opponent', min: 0, max: 1 },
        allowStage: true,
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-023'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { red: 1 }, discardHand: 0 },
    })
  })
})
