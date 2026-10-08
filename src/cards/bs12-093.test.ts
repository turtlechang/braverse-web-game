import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-093', 'BS12-093@1'])('%s keeps PPN ordinary three, independent hand Blocker and ordered two-Blocker Then cost', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const original = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-093', name: 'Rockstar Cookie', type: 'cookie', energyColor: 'purple', keywords: ['arena'],
    level: 2, hp: 4, attack: 3, attackCost: 3, attackEnergyCost: { purple: 2, neutral: 1 },
    skill: { trigger: 'block', restSource: false, oncePerTurn: false, yourTurn: false, faint: false,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    },
    attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: {}, trashToDeckBottom: { count: 2, cookieOnly: true, blockerOnly: true } },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    }],
  } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Rockstar')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.skill?.faintEffects).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe(number.includes('@')
    ? 'https://cookierunbraverse.com/data/en_storage/z0_k1JCgBHRIo4HrpmBdsA.webp'
    : 'https://cookierunbraverse.com/data/en_storage/dJd9L1X61ySVlBDt8H5iSw.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(original)
})

it.each(['free-block', 'two-hand', 'wrong-color', 'no-arena', 'cookie-hand', 'block-energy', 'REST', 'once', 'your-turn', 'activate', 'faint', 'extra-skill',
  'wrong-attack', 'wrong-hp', 'no-then', 'extra-then', 'mandatory', 'shuffle', 'one-bottom', 'three-bottom', 'non-cookie', 'non-blocker', 'extra-bottom-filter',
  'then-energy', 'then-hand', 'damage-two', 'self-target', 'mandatory-target', 'two-targets', 'fixed-original', 'target-color', 'damage-condition', 'extra-effect'] as const)('093 strict rejects runtime semantic mutation: %s', mutation => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-093') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Rockstar')
  const card = structuredClone(result.gameCard)
  const skill = card.skill!
  const then = card.attackEffects![0]
  if (then.kind !== 'optional-cost-attack' || then.effects[0].kind !== 'damage') throw new Error('Missing Then')
  const damage = then.effects[0]
  if (mutation === 'free-block') skill.cost.discardHand = 0
  if (mutation === 'two-hand') skill.cost.discardHand = 2
  if (mutation === 'wrong-color') skill.cost.discardHandColor = 'red'
  if (mutation === 'no-arena') delete skill.cost.discardHandKeyword
  if (mutation === 'cookie-hand') skill.cost.discardHandType = 'cookie'
  if (mutation === 'block-energy') skill.cost.energy = { purple: 1 }
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'activate') skill.trigger = 'activate'
  if (mutation === 'faint') skill.faint = true
  if (mutation === 'extra-skill') skill.effects.push({ kind: 'draw-up-to', max: 1 })
  if (mutation === 'wrong-attack') card.attackEnergyCost = { purple: 3 }
  if (mutation === 'wrong-hp') card.hp = 3
  if (mutation === 'no-then') card.attackEffects = []
  if (mutation === 'extra-then') card.attackEffects!.push({ kind: 'draw-up-to', max: 1 })
  if (mutation === 'mandatory') then.mandatory = true
  if (mutation === 'shuffle') { delete then.cost.trashToDeckBottom; then.cost.trashToDeck = { count: 2, cookieOnly: true } }
  if (mutation === 'one-bottom') then.cost.trashToDeckBottom!.count = 1
  if (mutation === 'three-bottom') then.cost.trashToDeckBottom!.count = 3
  if (mutation === 'non-cookie') delete then.cost.trashToDeckBottom!.cookieOnly
  if (mutation === 'non-blocker') delete then.cost.trashToDeckBottom!.blockerOnly
  if (mutation === 'extra-bottom-filter') then.cost.trashToDeckBottom!.nonCookieOnly = true
  if (mutation === 'then-energy') then.cost.energy = { purple: 1 }
  if (mutation === 'then-hand') then.cost.discardHand = 1
  if (mutation === 'damage-two') damage.amount = 2
  if (mutation === 'self-target') damage.target.side = 'self'
  if (mutation === 'mandatory-target') damage.target.min = 1
  if (mutation === 'two-targets') damage.target.max = 2
  if (mutation === 'fixed-original') damage.target.attackTargetOnly = true
  if (mutation === 'target-color') damage.target.energyColor = 'purple'
  if (mutation === 'damage-condition') damage.condition = { kind: 'player-started-second' }
  if (mutation === 'extra-effect') then.effects.push({ kind: 'draw-up-to', max: 1 })
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-093 lacks PPN ordinary three, purple Arena hand Blocker or optional ordered two own trash Blocker Cookie bottom cost before up-to-one opposing one damage')
})
