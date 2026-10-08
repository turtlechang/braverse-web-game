import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-018', 'BS12-018@1'])('%s separates mandatory EXTRA cost from free Activate and optional second-player attack damage', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const conversion = convertOfficialCardToExtraDeckCard(source)
  expect(convertOfficialCardToGameCard(source).status).toBe('unsupported')
  expect(conversion).toMatchObject({ status: 'converted', extraDeckCard: {
    type: 'extra', level: 2, hp: 5, attack: 4, attackEnergyCost: { red: 4 }, imageUrl: source.imageUrl,
    extraDeckPlayMode: 'enter-battle', playRequirement: { kind: 'break-level-at-least', level: 4 },
    extraDeckPlayCost: { energy: {}, discardHand: 1, discardHandKeyword: 'arena' },
    skill: { trigger: 'activate', oncePerTurn: true, restSource: false, cost: { energy: {}, discardHand: 0 }, effects: [
      { kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1, keyword: 'arena', energyColor: 'red', excludeSource: true } },
    ] },
    attackEffects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 }, condition: { kind: 'player-started-second' } }],
  } })
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
})
