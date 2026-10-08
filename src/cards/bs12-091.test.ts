import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-091', 'BS12-091@1'])('%s preserves physical Blocker and independent three-card faint cost before trash recovery', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const original = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-091', name: 'Caramel Arrow Cookie', type: 'cookie', energyColor: 'purple', keywords: ['arena'],
    level: 1, hp: 2, attack: 2, attackCost: 2, attackEnergyCost: { purple: 1, neutral: 1 },
    skill: { trigger: 'block', restSource: false, oncePerTurn: false, yourTurn: false, faint: true,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
      faintCost: { energy: {}, deckToTrash: { amount: 3 } },
      faintEffects: [{ kind: 'trash-to-hand', max: 1, cookieOnly: true, blockerOnly: true, excludeCardName: 'Caramel Arrow Cookie' }],
    },
  } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Caramel Arrow')
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe(number.includes('@')
    ? 'https://cookierunbraverse.com/data/en_storage/3nNeH2DwyA6ttc3c3ZvOmA.webp'
    : 'https://cookierunbraverse.com/data/en_storage/MUdWTa_oUwRp3sRVsC9LBw.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(original)
})

it.each(['free-block', 'two-hand', 'wrong-color', 'no-arena', 'cookie-only', 'block-energy', 'REST', 'once', 'your-turn', 'activate',
  'no-faint', 'shared-cost', 'two-deck', 'four-deck', 'faint-hand', 'faint-energy', 'no-recovery', 'extra-faint', 'shared-recovery', 'two-targets',
  'not-cookie-only', 'not-blocker-only', 'same-name-allowed', 'wrong-name', 'target-color', 'target-level', 'wrong-attack'] as const)('091 strict rejects runtime semantic mutation: %s', mutation => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-091') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Arrow')
  const card = structuredClone(result.gameCard)
  const skill = card.skill!
  if (mutation === 'free-block') skill.cost.discardHand = 0
  if (mutation === 'two-hand') skill.cost.discardHand = 2
  if (mutation === 'wrong-color') skill.cost.discardHandColor = 'red'
  if (mutation === 'no-arena') delete skill.cost.discardHandKeyword
  if (mutation === 'cookie-only') skill.cost.discardHandType = 'cookie'
  if (mutation === 'block-energy') skill.cost.energy = { purple: 1 }
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'activate') skill.trigger = 'activate'
  if (mutation === 'no-faint') skill.faint = false
  if (mutation === 'shared-cost') delete skill.faintCost
  if (mutation === 'two-deck' || mutation === 'four-deck') skill.faintCost!.deckToTrash!.amount = mutation === 'two-deck' ? 2 : 4
  if (mutation === 'faint-hand') skill.faintCost!.discardHand = 1
  if (mutation === 'faint-energy') skill.faintCost!.energy = { purple: 1 }
  const recovery = skill.faintEffects![0]
  if (recovery.kind !== 'trash-to-hand') throw new Error('Missing recovery')
  if (mutation === 'two-targets') recovery.max = 2
  if (mutation === 'not-cookie-only') delete recovery.cookieOnly
  if (mutation === 'not-blocker-only') delete recovery.blockerOnly
  if (mutation === 'same-name-allowed') delete recovery.excludeCardName
  if (mutation === 'wrong-name') recovery.excludeCardName = 'Milky Way Cookie'
  if (mutation === 'target-color') recovery.energyColor = 'purple'
  if (mutation === 'target-level') recovery.maxLevel = 1
  if (mutation === 'no-recovery') skill.faintEffects = []
  if (mutation === 'extra-faint') skill.faintEffects!.push({ kind: 'draw-up-to', max: 1 })
  if (mutation === 'shared-recovery') skill.effects.push(recovery)
  if (mutation === 'wrong-attack') card.attackEnergyCost = { purple: 2 }
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-091 lacks PN ordinary two, purple Arena hand Blocker or independent top-three faint cost before own trash other-name Blocker Cookie recovery')
})
