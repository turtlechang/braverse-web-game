import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('027 reduces Y1 to zero only for four own yellow Arena Cookies and keeps optional opponent -1', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-027') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const converted = convertOfficialCardToGameCard(source)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { name: "Designers' Yapping", type: 'trap', energyColor: 'yellow', keywords: ['arena'],
    trap: { cost: { energy: { yellow: 1 }, discardHand: 0 },
      conditionalCost: { condition: { kind: 'break-area-card-count-at-least', count: 4, color: 'yellow', keyword: 'arena' }, cost: { energy: {}, discardHand: 0 } },
      effects: [{ kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } }],
    } } })
  if (converted.status !== 'converted' || !converted.gameCard.trap) throw new Error('027 trap missing')
  expect(converted.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/SBHLbcfG6SysrC7lpN67FQ.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const trap = converted.gameCard.trap
  const changes = [
    { ...trap, conditionalCost: undefined },
    { ...trap, conditionalCost: { ...trap.conditionalCost!, condition: { kind: 'break-area-card-count-at-least' as const, count: 4 } } },
    { ...trap, conditionalCost: { ...trap.conditionalCost!, condition: { kind: 'break-area-card-count-at-least' as const, count: 4, color: 'yellow' as const } } },
    { ...trap, conditionalCost: { ...trap.conditionalCost!, condition: { kind: 'break-area-card-count-at-least' as const, count: 4, keyword: 'arena' as const } } },
    { ...trap, conditionalCost: { ...trap.conditionalCost!, cost: { energy: { yellow: 1 }, discardHand: 0 } } },
    { ...trap, cost: { energy: {}, discardHand: 0 } },
    { ...trap, condition: { kind: 'break-area-card-count-at-least' as const, count: 4 } },
    { ...trap, effects: [{ kind: 'modify-attack' as const, amount: -2, duration: 'this-turn' as const, target: { side: 'opponent' as const, min: 0, max: 1 } }] },
  ]
  for (const changed of changes) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, trap: changed }).contract.status).not.toBe('verified')
  expect(source).toEqual(snapshot)
})
