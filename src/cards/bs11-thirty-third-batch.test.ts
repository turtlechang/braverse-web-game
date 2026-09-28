import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialStageAbility,
} from '.'
import type { OfficialCardRecord } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const expectedEffect = {
  kind: 'draw-up-to-then-discard',
  max: 1,
  discardCount: 1,
  condition: { kind: 'cookie-played-via-special-play-this-turn' },
}

describe('BS11-108／108@1 candidate contract', () => {
  it('keeps the official Stage text, identity, and distinct card art', () => {
    expect(findCard('BS11-108')).toMatchObject({
      baseCardNumber: 'BS11-108',
      name: "Dark Enchantress's Castle",
      type: 'stage',
      energyType: 'BLACK',
      skill: {
        text: expect.stringContaining('played a Cookie via Special Play'),
      },
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/yBCmOJwjGj66Ithh8u1KDQ.webp',
    })
    expect(findCard('BS11-108@1')).toMatchObject({
      baseCardNumber: 'BS11-108',
      variant: '1',
      type: 'stage',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/djGYzYlkURHd214FaK8RzQ.webp',
    })
    expect(findCard('BS11-108@1').imageUrl).not.toBe(findCard('BS11-108').imageUrl)
  })
})

describe('BS11-108 exact Stage adapter', () => {
  it('converts both printings with the black placement cost, REST cost, and gated Then effect', () => {
    for (const cardNumber of ['BS11-108', 'BS11-108@1']) {
      const record = findCard(cardNumber)
      expect(convertOfficialCardEffects(record)).toMatchObject({
        status: 'supported',
        effects: [expectedEffect],
      })
      expect(convertOfficialStageAbility(record)).toMatchObject({
        placementCost: { black: 1 },
        cost: { energy: {}, discardHand: 0 },
        restSource: true,
        effects: [expectedEffect],
      })

      const converted = convertOfficialCardToGameCard(record)
      expect(converted.status).toBe('converted')
      if (converted.status !== 'converted') return
      expect(converted.gameCard).toMatchObject({
        type: 'stage',
        stageAbility: {
          placementCost: { black: 1 },
          cost: { energy: {}, discardHand: 0 },
          restSource: true,
          effects: [expectedEffect],
        },
      })
    }
  })
})
