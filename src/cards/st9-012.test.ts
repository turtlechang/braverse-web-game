import { describe, expect, it } from 'vitest'
import formalDocument from '../../data/cards/official-st9-012.en.json'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'

const formalCards = formalDocument.cards as OfficialCardRecord[]
const printedCard = formalCards.find(card => card.cardNumber === 'ST9-012')
if (!printedCard) throw new Error('Promoted original ST9-012 printing is required')

describe('ST9-012 original printing and behavior contract', () => {
  it('keeps the printed On Play condition and optional attack payment separate', () => {
    expect(printedCard).toMatchObject({
      cardNumber: 'ST9-012',
      name: 'White Pearl Cookie',
      type: 'cookie',
      level: 1,
      hp: 2,
      color: 'BLUE',
      energyType: 'BLUE',
      attackText: "<{B}{B}> Gem Mermaid Strength {da} 2 Then, <can be used as {B}.> If [Sea Fairy Cookie] is in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
      imageUrl: expect.stringMatching(/^https:\/\/cookierunbraverse\.com\//),
    })

    const converted = convertOfficialCardToGameCard(printedCard, 'ST9-012-test')
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('ST9-012 must convert')

    expect(converted.gameCard).toMatchObject({
      id: 'ST9-012',
      name: 'White Pearl Cookie',
      type: 'cookie',
      cardColor: 'blue',
      energyColor: 'blue',
      level: 1,
      hp: 2,
      attack: 2,
      attackEnergyCost: { blue: 2 },
      skill: {
        trigger: 'on-play',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'hand-count-at-most', count: 4 },
        }],
      },
      attackEffects: [{
        kind: 'optional-cost-attack',
        resolution: 'ability',
        cost: { energy: { blue: 1 }, discardHand: 0 },
        effects: [{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Sea Fairy Cookie',
          },
        }],
      }],
    })

    const audit = analyzeOfficialCardBehavior(printedCard)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.payments).toContainEqual({
      kind: 'source-energy',
      energy: { blue: 1 },
      clauseIds: [expect.stringMatching(/^attack-/)],
    })
  })
})
