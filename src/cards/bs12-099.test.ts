import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-099') as OfficialCardRecord

it('099 preserves the complete physical faint-only top-three cost and black Arena Cookie recovery', () => {
  const original = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-099', name: 'Cake Hound', type: 'cookie', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 2, keywords: ['arena'], attack: 2, attackCost: 2, attackEnergyCost: { black: 2 },
    skill: { trigger: 'passive', faint: true, restSource: false, oncePerTurn: false, yourTurn: false,
      cost: { energy: {}, discardHand: 0, deckToTrash: { amount: 3 } },
      effects: [{ kind: 'trash-to-hand', max: 1, cookieOnly: true, energyColor: 'black', keyword: 'arena' }],
    },
  } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Cake Hound')
  expect(result.gameCard.skill?.faintCost).toBeUndefined()
  expect(result.gameCard.skill?.faintEffects).toBeUndefined()
  expect(result.gameCard.skill?.specialPlayCost).toBeUndefined()
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.extraDeckOrigin).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/pVFXDMtpD8mMMENSu_BSbg.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(original)
})

it.each(['no-skill', 'no-faint', 'activate', 'once', 'REST', 'your-turn', 'free', 'mill-two', 'mill-four',
  'energy', 'hand', 'support', 'faint-override', 'no-recovery', 'extra-effect', 'two-targets', 'not-cookie',
  'no-color', 'wrong-color', 'no-arena', 'blocker-only', 'same-name-excluded', 'max-level', 'condition',
  'hp', 'level', 'damage', 'neutral-attack', 'no-keyword', 'flip', 'then', 'special'] as const)(
  '099 strict rejects the runtime semantic mutation %s', mutation => {
    const result = convertOfficialCardToGameCard(record)
    if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Cake Hound')
    const card = structuredClone(result.gameCard), skill = card.skill!
    const recovery = skill.effects[0]
    if (recovery.kind !== 'trash-to-hand') throw new Error('Missing recovery')
    if (mutation === 'no-skill') card.skill = undefined
    if (mutation === 'no-faint') skill.faint = false
    if (mutation === 'activate') skill.trigger = 'activate'
    if (mutation === 'once') skill.oncePerTurn = true
    if (mutation === 'REST') skill.restSource = true
    if (mutation === 'your-turn') skill.yourTurn = true
    if (mutation === 'free') skill.cost.deckToTrash = undefined
    if (mutation === 'mill-two' || mutation === 'mill-four') skill.cost.deckToTrash!.amount = mutation === 'mill-two' ? 2 : 4
    if (mutation === 'energy') skill.cost.energy = { black: 1 }
    if (mutation === 'hand') skill.cost.discardHand = 1
    if (mutation === 'support') skill.cost.supportToTrash = 1
    if (mutation === 'faint-override') skill.faintCost = { energy: {} }
    if (mutation === 'no-recovery') skill.effects = []
    if (mutation === 'extra-effect') skill.effects.push({ kind: 'draw-up-to', max: 1 })
    if (mutation === 'two-targets') recovery.max = 2
    if (mutation === 'not-cookie') recovery.cookieOnly = false
    if (mutation === 'no-color') recovery.energyColor = undefined
    if (mutation === 'wrong-color') recovery.energyColor = 'purple'
    if (mutation === 'no-arena') recovery.keyword = undefined
    if (mutation === 'blocker-only') recovery.blockerOnly = true
    if (mutation === 'same-name-excluded') recovery.excludeCardName = 'Cake Hound'
    if (mutation === 'max-level') recovery.maxLevel = 1
    if (mutation === 'condition') recovery.condition = { kind: 'hand-count-at-most', count: 5 }
    if (mutation === 'hp') card.hp = 1
    if (mutation === 'level') card.level = 2
    if (mutation === 'damage') card.attack = 3
    if (mutation === 'neutral-attack') card.attackEnergyCost = { neutral: 2 }
    if (mutation === 'no-keyword') card.keywords = []
    if (mutation === 'flip') card.flip = { text: 'Unprinted', cost: { energy: {} }, effects: [{ kind: 'draw-up-to', max: 1 }] }
    if (mutation === 'then') card.attackEffects = [{ kind: 'draw-up-to', max: 1 }]
    if (mutation === 'special') skill.specialPlayCost = { energy: {} }
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-099 lacks black Arena LV1 HP2, KK ordinary two or faint-only top-three cost before zero-to-one own trash black Arena Cookie recovery')
  },
)
