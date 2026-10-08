import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-100') as OfficialCardRecord
const error = 'BS12-100 lacks black Arena LV1 HP1, black LV1 Special Play, KK ordinary two or free own trash Arena Cookie with Special Play recovery up to one'

it('100 preserves independently read black LV1 Special Play and free Arena AND Special Play trash recovery', () => {
  const before = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-100', name: 'Strategist Cake Hound', type: 'cookie', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 1, attack: 2, attackCost: 2, attackEnergyCost: { black: 2 }, keywords: ['arena'],
    skill: { trigger: 'passive', oncePerTurn: false, restSource: false, yourTurn: false,
      cost: { energy: {}, discardHand: 0 }, effects: [],
      specialPlayCost: { energy: {}, discardHand: 0, trashBattleCookie: { count: 1, energyColor: 'black', level: 1 } } },
    flip: { cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'trash-to-hand', max: 1, cookieOnly: true, keyword: 'arena', hasSpecialPlay: true }] },
  } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Strategist Cake Hound')
  expect(result.gameCard.attackEffects ?? []).toEqual([])
  expect(result.gameCard.skill?.faint).toBe(false)
  expect(result.gameCard.extraDeckOrigin).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/ojU9_StnFHAoooSM892dhA.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'neutral-attack', 'no-arena', 'no-skill', 'activate', 'once', 'REST', 'your-turn',
  'main-cost', 'main-effect', 'faint', 'no-special', 'special-count', 'special-color', 'special-level', 'special-arena',
  'special-faint', 'special-break', 'special-hand', 'no-flip', 'flip-hand', 'flip-energy', 'flip-mill', 'no-recovery',
  'two-recovery', 'not-cookie', 'no-arena-recovery', 'no-special-recovery', 'black-only', 'max-level', 'same-name-excluded',
  'blocker-only', 'condition', 'extra-effect', 'then', 'attached-hp'] as const)('100 strict rejects runtime semantic mutation: %s', mutation => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Strategist')
  const card = structuredClone(result.gameCard), skill = card.skill!, special = skill.specialPlayCost!, flip = card.flip!, recovery = flip.effects[0]
  if (recovery.kind !== 'trash-to-hand') throw new Error('Missing printed recovery')
  if (mutation === 'level') card.level = 2
  if (mutation === 'hp') card.hp = 2
  if (mutation === 'damage') card.attack = 3
  if (mutation === 'neutral-attack') card.attackEnergyCost = { neutral: 2 }
  if (mutation === 'no-arena') card.keywords = []
  if (mutation === 'no-skill') card.skill = undefined
  if (mutation === 'activate') skill.trigger = 'activate'
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'main-cost') skill.cost.discardHand = 1
  if (mutation === 'main-effect') skill.effects = [{ kind: 'draw', amount: 1 }]
  if (mutation === 'faint') skill.faint = true
  if (mutation === 'no-special') skill.specialPlayCost = undefined
  if (mutation === 'special-count') special.trashBattleCookie!.count = 2
  if (mutation === 'special-color') special.trashBattleCookie!.energyColor = 'red'
  if (mutation === 'special-level') special.trashBattleCookie!.level = 2
  if (mutation === 'special-arena') special.trashBattleCookie!.keyword = 'arena'
  if (mutation === 'special-faint') special.trashBattleCookie!.faint = true
  if (mutation === 'special-break') special.trashBattleCookie!.toBreakArea = true
  if (mutation === 'special-hand') special.discardHand = 1
  if (mutation === 'no-flip') card.flip = undefined
  if (mutation === 'flip-hand') flip.cost.discardHand = 1
  if (mutation === 'flip-energy') flip.cost.energy = { black: 1 }
  if (mutation === 'flip-mill') flip.cost.deckToTrash = { amount: 3 }
  if (mutation === 'no-recovery') flip.effects = []
  if (mutation === 'two-recovery') recovery.max = 2
  if (mutation === 'not-cookie') recovery.cookieOnly = false
  if (mutation === 'no-arena-recovery') recovery.keyword = undefined
  if (mutation === 'no-special-recovery') recovery.hasSpecialPlay = false
  if (mutation === 'black-only') recovery.energyColor = 'black'
  if (mutation === 'max-level') recovery.maxLevel = 1
  if (mutation === 'same-name-excluded') recovery.excludeCardName = 'Strategist Cake Hound'
  if (mutation === 'blocker-only') recovery.blockerOnly = true
  if (mutation === 'condition') recovery.condition = { kind: 'hand-count-at-most', count: 5 }
  if (mutation === 'extra-effect') flip.effects.push({ kind: 'draw', amount: 1 })
  if (mutation === 'then') card.attackEffects = [{ kind: 'draw', amount: 1 }]
  if (mutation === 'attached-hp') flip.attachedHpBonus = 1
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
})
