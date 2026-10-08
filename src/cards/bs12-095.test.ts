import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-095') as OfficialCardRecord
const error = 'BS12-095 lacks black Arena LV1 HP1, independent black LV1 Special Play, KK ordinary two or paid zero-to-one own Arena HP FLIP'
const converted = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Blueberry Cake Hound')
  return result.gameCard
}

it('095 preserves independently read Special Play, two black ordinary two and paid optional Arena HP FLIP', () => {
  const before = structuredClone(record)
  const card = converted()
  expect(card).toMatchObject({ id: 'BS12-095', name: 'Blueberry Cake Hound', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 1, attack: 2, attackCost: 2, attackEnergyCost: { black: 2 }, keywords: ['arena'],
    attackText: '<{K}{K}> Drool {da} 2', imageUrl: 'https://cookierunbraverse.com/data/en_storage/bO0ROB0HypLTCBjrDJE5XQ.webp' })
  expect(card.skill).toMatchObject({ trigger: 'passive', oncePerTurn: false, restSource: false, yourTurn: false,
    cost: { energy: {}, discardHand: 0 }, specialPlayCost: { energy: {}, discardHand: 0,
      trashBattleCookie: { count: 1, energyColor: 'black', level: 1 } }, effects: [] })
  expect(card.flip).toMatchObject({ cost: { energy: {}, discardHand: 1 }, effects: [
    { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, keyword: 'arena' } },
  ] })
  expect(card.flip?.effects).toHaveLength(1)
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.extraDeckOrigin).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'attack-cost', 'neutral-cost', 'color', 'no-arena', 'skill-missing', 'activate', 'once', 'rest', 'your-turn',
  'special-missing', 'special-count', 'special-color', 'special-level', 'special-arena', 'special-break', 'special-faint', 'special-discard',
  'flip-missing', 'flip-free', 'flip-hand-color', 'flip-hand-keyword', 'flip-damage', 'flip-opponent', 'flip-two', 'flip-any-cookie', 'flip-color', 'flip-condition', 'then'] as const)(
  '095 strict rejects an actual runtime mutation: %s', mutation => {
    const card = structuredClone(converted())
    const skill = card.skill!, flip = card.flip!, special = skill.specialPlayCost!
    const hp = flip.effects[0]
    if (hp.kind !== 'gain-hp' || !hp.target) throw new Error('Missing printed HP FLIP')
    if (mutation === 'level') card.level = 2
    if (mutation === 'hp') card.hp = 2
    if (mutation === 'damage') card.attack = 3
    if (mutation === 'attack-cost') card.attackCost = 1
    if (mutation === 'neutral-cost') card.attackEnergyCost = { neutral: 2 }
    if (mutation === 'color') card.energyColor = 'purple'
    if (mutation === 'no-arena') card.keywords = []
    if (mutation === 'skill-missing') card.skill = undefined
    if (mutation === 'activate') skill.trigger = 'activate'
    if (mutation === 'once') skill.oncePerTurn = true
    if (mutation === 'rest') skill.restSource = true
    if (mutation === 'your-turn') skill.yourTurn = true
    if (mutation === 'special-missing') skill.specialPlayCost = undefined
    if (mutation === 'special-count') special.trashBattleCookie!.count = 2
    if (mutation === 'special-color') special.trashBattleCookie!.energyColor = 'purple'
    if (mutation === 'special-level') special.trashBattleCookie!.level = 2
    if (mutation === 'special-arena') special.trashBattleCookie!.keyword = 'arena'
    if (mutation === 'special-break') special.trashBattleCookie!.toBreakArea = true
    if (mutation === 'special-faint') special.trashBattleCookie!.faint = true
    if (mutation === 'special-discard') special.discardHand = 1
    if (mutation === 'flip-missing') card.flip = undefined
    if (mutation === 'flip-free') flip.cost.discardHand = 0
    if (mutation === 'flip-hand-color') flip.cost.discardHandColor = 'black'
    if (mutation === 'flip-hand-keyword') flip.cost.discardHandKeyword = 'arena'
    if (mutation === 'flip-damage') hp.amount = 2
    if (mutation === 'flip-opponent') hp.target.side = 'opponent'
    if (mutation === 'flip-two') hp.target.max = 2
    if (mutation === 'flip-any-cookie') hp.target.keyword = undefined
    if (mutation === 'flip-color') hp.target.energyColor = 'black'
    if (mutation === 'flip-condition') hp.condition = { kind: 'hand-count-at-most', count: 5 }
    if (mutation === 'then') card.attackEffects = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }]
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  },
)
