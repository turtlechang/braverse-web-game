import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-096') as OfficialCardRecord
const error = 'BS12-096 lacks black Arena LV1 HP1, black LV1 Special Play, KK ordinary two or free draw up to two requiring both own hand at most five and one own black Arena battle Cookie'
const converted = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Crimson Danger Cake Hound')
  return result.gameCard
}

it('096 preserves independently read Special Play and free conditional draw without limiting the resulting hand', () => {
  const before = structuredClone(record), card = converted()
  expect(card).toMatchObject({ id: 'BS12-096', name: 'Crimson Danger Cake Hound', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 1, attack: 2, attackCost: 2, attackEnergyCost: { black: 2 }, keywords: ['arena'],
    attackText: '<{K}{K}> Annoy {da} 2', imageUrl: 'https://cookierunbraverse.com/data/en_storage/pxX9-bMMaeiRUyUQughevQ.webp' })
  expect(card.skill).toMatchObject({ trigger: 'passive', oncePerTurn: false, restSource: false, yourTurn: false,
    cost: { energy: {}, discardHand: 0 }, specialPlayCost: { energy: {}, discardHand: 0,
      trashBattleCookie: { count: 1, energyColor: 'black', level: 1 } }, effects: [] })
  expect(card.flip).toMatchObject({ cost: { energy: {}, discardHand: 0 }, effects: [
    { kind: 'draw-up-to', max: 2, condition: { kind: 'all-of', conditions: [
      { kind: 'hand-count-at-most', count: 5 },
      { kind: 'battle-area-has-color', side: 'self', color: 'black', keyword: 'arena' },
    ] } },
  ] })
  expect(card.flip?.effects).toHaveLength(1)
  const draw = card.flip!.effects[0]
  if (draw.kind !== 'draw-up-to') throw new Error('Missing printed draw')
  expect(draw.untilHandSize).toBeUndefined()
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.extraDeckOrigin).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'neutral-cost', 'no-arena', 'skill-missing', 'activate', 'once', 'rest', 'your-turn',
  'special-missing', 'special-count', 'special-color', 'special-level', 'special-arena', 'special-faint', 'special-break', 'special-discard',
  'flip-missing', 'flip-discard', 'flip-energy', 'draw-three', 'draw-until-five', 'draw-condition-missing', 'hand-six', 'hand-four',
  'hand-missing', 'field-missing', 'field-other-color', 'field-opponent', 'field-no-arena', 'field-another', 'field-level', 'then'] as const)(
  '096 strict rejects a runtime semantic mutation: %s', mutation => {
    const card = structuredClone(converted()), skill = card.skill!, flip = card.flip!, special = skill.specialPlayCost!, draw = flip.effects[0]
    if (draw.kind !== 'draw-up-to' || draw.condition?.kind !== 'all-of') throw new Error('Missing printed conjunctive draw')
    const condition = draw.condition, hand = condition.conditions.find(c => c.kind === 'hand-count-at-most'), field = condition.conditions.find(c => c.kind === 'battle-area-has-color')
    if (!hand || !field) throw new Error('Missing printed hand and same-Cookie field conditions')
    if (mutation === 'level') card.level = 2
    if (mutation === 'hp') card.hp = 2
    if (mutation === 'damage') card.attack = 3
    if (mutation === 'neutral-cost') card.attackEnergyCost = { neutral: 2 }
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
    if (mutation === 'special-faint') special.trashBattleCookie!.faint = true
    if (mutation === 'special-break') special.trashBattleCookie!.toBreakArea = true
    if (mutation === 'special-discard') special.discardHand = 1
    if (mutation === 'flip-missing') card.flip = undefined
    if (mutation === 'flip-discard') flip.cost.discardHand = 1
    if (mutation === 'flip-energy') flip.cost.energy = { black: 1 }
    if (mutation === 'draw-three') draw.max = 3
    if (mutation === 'draw-until-five') draw.untilHandSize = 5
    if (mutation === 'draw-condition-missing') draw.condition = undefined
    if (mutation === 'hand-six') hand.count = 6
    if (mutation === 'hand-four') hand.count = 4
    if (mutation === 'hand-missing') condition.conditions = [field]
    if (mutation === 'field-missing') condition.conditions = [hand]
    if (mutation === 'field-other-color') field.color = 'purple'
    if (mutation === 'field-opponent') field.side = 'opponent'
    if (mutation === 'field-no-arena') field.keyword = undefined
    if (mutation === 'field-another') field.excludeSource = true
    if (mutation === 'field-level') field.level = 1
    if (mutation === 'then') card.attackEffects = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }]
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  },
)
