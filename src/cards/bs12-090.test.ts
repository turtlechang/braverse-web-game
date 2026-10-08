import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-090', 'BS12-090@1'])('%s preserves independently read Blocker and free conditional faint movement', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-090', name: 'Milky Way Cookie', energyColor: 'purple',
    level: 2, hp: 4, attack: 3, attackCost: 3, attackEnergyCost: { purple: 2, neutral: 1 }, keywords: ['arena'],
    skill: { trigger: 'block', restSource: false, oncePerTurn: false, yourTurn: false, faint: true,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
      faintCost: { energy: {} },
      faintEffects: [{ kind: 'break-to-trash', max: 1, exactLevel: 1,
        condition: { kind: 'break-blocker-cookie-count-at-least', count: 4 } }],
    } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Milky Way')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe(number.includes('@')
    ? 'https://cookierunbraverse.com/data/en_storage/QeGZpIxvZ4ODNy317kXIdw.webp'
    : 'https://cookierunbraverse.com/data/en_storage/sC_osHZ-h9mnlxtjqNH6tw.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['free-block', 'wrong-block-count', 'wrong-color', 'no-arena', 'cookie-only', 'block-energy', 'REST', 'once', 'your-turn',
  'no-faint', 'no-faint-effects', 'shared-cost', 'paid-faint', 'wrong-level', 'two-targets', 'target-color', 'no-condition', 'trash-condition',
  'three-blockers', 'five-blockers', 'extra-faint', 'shared-effects', 'wrong-attack', 'activate'] as const)('090 strict rejects runtime mutation: %s', mutation => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-090') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(source)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Milky Way')
  const card = structuredClone(result.gameCard)
  const skill = card.skill!
  if (mutation === 'free-block') skill.cost.discardHand = 0
  if (mutation === 'wrong-block-count') skill.cost.discardHand = 2
  if (mutation === 'wrong-color') skill.cost.discardHandColor = 'red'
  if (mutation === 'no-arena') delete skill.cost.discardHandKeyword
  if (mutation === 'cookie-only') skill.cost.discardHandType = 'cookie'
  if (mutation === 'block-energy') skill.cost.energy = { purple: 1 }
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'no-faint') skill.faint = false
  if (mutation === 'no-faint-effects') delete skill.faintEffects
  if (mutation === 'shared-cost') delete skill.faintCost
  if (mutation === 'paid-faint') skill.faintCost!.discardHand = 1
  const move = skill.faintEffects?.[0]
  if (move?.kind === 'break-to-trash') {
    if (mutation === 'wrong-level') move.exactLevel = 2
    if (mutation === 'two-targets') move.max = 2
    if (mutation === 'target-color') move.energyColor = 'purple'
    if (mutation === 'no-condition') delete move.condition
    if (mutation === 'trash-condition') move.condition = { kind: 'trash-blocker-cookie-count-at-least', count: 4 }
    if (mutation === 'three-blockers' || mutation === 'five-blockers') move.condition = { kind: 'break-blocker-cookie-count-at-least', count: mutation === 'three-blockers' ? 3 : 5 }
  }
  if (mutation === 'extra-faint') skill.faintEffects!.push({ kind: 'draw-up-to', max: 1 })
  if (mutation === 'shared-effects') skill.effects.push({ kind: 'draw-up-to', max: 1 })
  if (mutation === 'wrong-attack') card.attackEnergyCost = { purple: 3 }
  if (mutation === 'activate') skill.trigger = 'activate'
  expect(analyzeOfficialCardBehavior(source, card).errors).toContain('BS12-090 lacks PPN ordinary three, purple Arena hand Blocker or free faint four-Blocker own Break LV1-to-trash selection')
})
