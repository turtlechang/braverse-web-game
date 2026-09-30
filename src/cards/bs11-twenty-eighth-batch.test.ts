import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToExtraDeckCard,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-116 candidate contract', () => {
  it('keeps both official Dark Enchantress Awakened arts and the printed HP bonus text', () => {
    expect(records.filter((card) => /^BS11-116(?:@1)?$/.test(card.cardNumber)))
      .toHaveLength(2)
    expect(findCard('BS11-116')).toMatchObject({
      type: 'extra',
      name: 'Dark Enchantress Cookie',
      level: 5,
      hp: null,
      energyType: 'BLACK',
      skill: {
        text: expect.stringContaining('your break area is LV.7 or higher'),
      },
      attackText: '<{K}{K}{K}{K}> Fornacem Accende! {da} 7',
    })
    expect(findCard('BS11-116').imageUrl).not.toBe(findCard('BS11-116@1').imageUrl)
  })
})

describe('BS11-116 exact EXTRA adapter', () => {
  it.each(['BS11-116', 'BS11-116@1'])('converts %s to the named Awaken contract', (cardNumber) => {
    const result = convertOfficialCardToExtraDeckCard(findCard(cardNumber), cardNumber)
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return

    expect(result.extraDeckCard).toMatchObject({
      id: 'BS11-116',
      type: 'extra',
      name: 'Dark Enchantress Cookie',
      level: 5,
      hp: 2,
      attack: 7,
      attackCost: 4,
      attackEnergyCost: { black: 4 },
      extraDeckPlayMode: 'awaken',
      awakenHpBonus: 2,
      playRequirement: {
        kind: 'all-of',
        conditions: [
          { kind: 'break-level-at-least', level: 7 },
          {
            kind: 'stage-has-card',
            side: 'self',
            cardName: "Dark Enchantress's Castle",
          },
        ],
      },
      awakenRequirement: {
        targetName: 'Dark Enchantress Cookie',
        requiresSpecialPlay: true,
      },
      skill: {
        trigger: 'passive',
        effects: [],
        passiveEffects: [{
          kind: 'prevent-opponent-battle-movement',
          sourceOnly: true,
        }],
      },
    })
    expect(convertOfficialAttackEffects(findCard(cardNumber))).toBeUndefined()
  })
})
