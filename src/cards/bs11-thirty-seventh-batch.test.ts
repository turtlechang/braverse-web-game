import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialItemAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === 'BS11-047')
  if (!card) throw new Error('Missing BS11 candidate fixture: BS11-047')
  return card
}

describe('BS11-047 Dumpling Censer candidate contract', () => {
  it('preserves the inventory source, official text, and confirmed art', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)
    expect(findCard()).toMatchObject({
      sourceId: 53162,
      locale: 'en',
      cardNumber: 'BS11-047',
      baseCardNumber: 'BS11-047',
      variant: null,
      name: 'Dumpling Censer',
      type: 'item',
      officialType: 'ITEM',
      color: 'GREEN',
      energyType: 'GREEN',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/jeJ0q4m3sECBV87h0o95oA.webp',
      skill: {
        name: null,
        text: expect.stringContaining('your opponent\'s Cookies\' 【On Play】 become'),
      },
    })
  })
})

describe('BS11-047 Dumpling Censer exact adapter', () => {
  it('converts its activation cost and this-turn paid replacement', () => {
    const record = findCard()
    expect(convertOfficialCardEffects(record)).toMatchObject({
      status: 'supported',
      cardNumber: 'BS11-047',
      effects: [{
        kind: 'replace-opponent-on-play',
        duration: 'this-turn',
        cost: { energy: { neutral: 1 }, discardHand: 0 },
        effects: [{ kind: 'support-to-hand', amount: 1 }],
      }],
    })
    expect(convertOfficialItemAbility(record)).toMatchObject({
      cost: { energy: { green: 1 }, discardHand: 0, supportToHand: 1 },
      effects: [{ kind: 'replace-opponent-on-play' }],
    })
    expect(convertOfficialCardToGameCard(record, 'bs11-thirty-seventh-047')).toMatchObject({
      status: 'converted',
      gameCard: {
        type: 'item',
        item: {
          cost: { energy: { green: 1 }, discardHand: 0, supportToHand: 1 },
          effects: [{ kind: 'replace-opponent-on-play' }],
        },
      },
    })
  })
})
