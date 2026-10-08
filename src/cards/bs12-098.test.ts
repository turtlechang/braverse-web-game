import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-098') as OfficialCardRecord
const error = 'BS12-098 lacks black Arena LV1 HP1, black LV1 Special Play, KK ordinary two or free fixed original LV2-or-higher HP bearer gain requiring one own black Arena battle Cookie'
const converted = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Caramel Pudding Cake Hound')
  return result.gameCard
}

it('098 preserves independent printed Special Play and free fixed-bearer conditional FLIP', () => {
  const before = structuredClone(record), card = converted()
  expect(card).toMatchObject({ id: 'BS12-098', name: 'Caramel Pudding Cake Hound', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 1, attack: 2, attackCost: 2, attackEnergyCost: { black: 2 }, keywords: ['arena'],
    attackText: '<{K}{K}> Relaxing Nap {da} 2', imageUrl: 'https://cookierunbraverse.com/data/en_storage/dFew6VHNFEIeRqv3ux71oA.webp' })
  expect(card.skill).toMatchObject({ trigger: 'passive', oncePerTurn: false, restSource: false, yourTurn: false,
    cost: { energy: {}, discardHand: 0 }, specialPlayCost: { energy: {}, discardHand: 0,
      trashBattleCookie: { count: 1, energyColor: 'black', level: 1 } }, effects: [] })
  expect(card.flip).toMatchObject({ cost: { energy: {}, discardHand: 0 }, effects: [
    { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1, sourceOnly: true, minLevel: 2 },
      condition: { kind: 'battle-area-has-color', side: 'self', color: 'black', keyword: 'arena' } },
  ] })
  expect(card.flip?.effects).toHaveLength(1)
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.extraDeckOrigin).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'neutral-cost', 'no-arena', 'skill-missing', 'activate', 'once', 'rest', 'your-turn',
  'special-missing', 'special-count', 'special-color', 'special-level', 'special-arena', 'special-faint', 'special-break', 'special-discard',
  'flip-missing', 'flip-discard', 'flip-energy', 'gain-two', 'target-other', 'target-zero', 'target-two', 'target-opponent',
  'target-level-missing', 'target-level-one', 'target-level-three', 'target-black', 'target-arena', 'target-rested',
  'condition-missing', 'field-other-color', 'field-opponent', 'field-no-arena', 'field-another', 'field-level', 'alternate-target', 'then'] as const)(
  '098 strict rejects a runtime semantic mutation: %s', mutation => {
    const card = structuredClone(converted()), skill = card.skill!, flip = card.flip!, special = skill.specialPlayCost!, gain = flip.effects[0]
    if (gain.kind !== 'gain-hp' || !gain.target || gain.condition?.kind !== 'battle-area-has-color') throw new Error('Missing fixed-bearer HP gain')
    const target = gain.target, field = gain.condition
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
    if (mutation === 'gain-two') gain.amount = 2
    if (mutation === 'target-other') target.sourceOnly = undefined
    if (mutation === 'target-zero') target.min = 0
    if (mutation === 'target-two') target.max = 2
    if (mutation === 'target-opponent') target.side = 'opponent'
    if (mutation === 'target-level-missing') target.minLevel = undefined
    if (mutation === 'target-level-one') target.minLevel = 1
    if (mutation === 'target-level-three') target.minLevel = 3
    if (mutation === 'target-black') target.energyColor = 'black'
    if (mutation === 'target-arena') target.keyword = 'arena'
    if (mutation === 'target-rested') target.restedOnly = true
    if (mutation === 'condition-missing') gain.condition = undefined
    if (mutation === 'field-other-color') field.color = 'purple'
    if (mutation === 'field-opponent') field.side = 'opponent'
    if (mutation === 'field-no-arena') field.keyword = undefined
    if (mutation === 'field-another') field.excludeSource = true
    if (mutation === 'field-level') field.level = 1
    if (mutation === 'alternate-target') flip.attachedHpAlternateTarget = { side: 'self', min: 0, max: 1 }
    if (mutation === 'then') card.attackEffects = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }]
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  },
)
