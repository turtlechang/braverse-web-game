import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-104') as OfficialCardRecord
const error = 'BS12-104 lacks black Arena K1 Item, independent optional draw one then own Special Play Cookie attack plus one this turn'

it('104 pays K1, optionally draws one then independently buffs one own Special Play Cookie for this turn', () => {
  const snapshot = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-104', name: 'Recipe For Acting Success', type: 'item', cardColor: 'black', energyColor: 'black', keywords: ['arena'],
    item: { cost: { energy: { black: 1 }, discardHand: 0 }, effects: [
      { kind: 'draw-up-to', max: 1 },
      { kind: 'modify-attack', amount: 1, duration: 'this-turn', target: { side: 'self', min: 0, max: 1, hasSpecialPlay: true } },
    ] }, imageUrl: 'https://cookierunbraverse.com/data/en_storage/pdBfvOQpbT87nFqFVK3fsQ.webp',
  } })
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})

it.each(['name', 'color', 'energy-color', 'arena', 'no-item', 'free', 'wrong-energy', 'extra-energy', 'discard', 'mill', 'hp-cost',
  'override', 'inactive', 'no-effects', 'extra-effect', 'reversed', 'forced-draw', 'draw-two', 'draw-zero', 'conditional-draw',
  'bonus-zero', 'bonus-two', 'persistent', 'next-turn', 'opponent', 'min-one', 'max-two', 'no-special', 'black-only',
  'arena-only', 'blocker-only', 'level-limit', 'rested-only', 'name-only', 'source-only', 'attack-target', 'conditional-bonus', 'ready-then'] as const)(
  '104 strict rejects a runtime semantic mutation: %s', mutation => {
    const result = convertOfficialCardToGameCard(record)
    if (result.status !== 'converted' || !result.gameCard.item) throw new Error('Missing Recipe Item')
    const card = structuredClone(result.gameCard), ability = card.item!, draw = ability.effects[0], buff = ability.effects[1]
    if (draw.kind !== 'draw-up-to' || buff.kind !== 'modify-attack') throw new Error('Missing ordered Recipe effects')
    if (mutation === 'name') card.name = 'Wrong Item'
    if (mutation === 'color') card.cardColor = 'purple'
    if (mutation === 'energy-color') card.energyColor = 'red'
    if (mutation === 'arena') card.keywords = []
    if (mutation === 'no-item') card.item = undefined
    if (mutation === 'free') ability.cost.energy = {}
    if (mutation === 'wrong-energy') ability.cost.energy = { purple: 1 }
    if (mutation === 'extra-energy') ability.cost.energy = { black: 1, neutral: 1 }
    if (mutation === 'discard') ability.cost.discardHand = 1
    if (mutation === 'mill') ability.cost.deckToTrash = { amount: 1 }
    if (mutation === 'hp-cost') ability.cost.hpToTrash = { amount: 1 }
    if (mutation === 'override') ability.activationCostOverride = { condition: 'friendly-cookie-fainted-this-turn', cost: { energy: {} } }
    if (mutation === 'inactive') ability.allowInactiveConditionalEffects = true
    if (mutation === 'no-effects') ability.effects = []
    if (mutation === 'extra-effect') ability.effects.push({ kind: 'draw', amount: 1 })
    if (mutation === 'reversed') ability.effects.reverse()
    if (mutation === 'forced-draw') ability.effects[0] = { kind: 'draw', amount: 1 }
    if (mutation === 'draw-two') draw.max = 2
    if (mutation === 'draw-zero') draw.max = 0
    if (mutation === 'conditional-draw') draw.condition = { kind: 'hand-count-at-most', count: 5 }
    if (mutation === 'bonus-zero') buff.amount = 0
    if (mutation === 'bonus-two') buff.amount = 2
    if (mutation === 'persistent') buff.duration = 'persistent'
    if (mutation === 'next-turn') buff.duration = 'own-next-turn'
    if (mutation === 'opponent') buff.target.side = 'opponent'
    if (mutation === 'min-one') buff.target.min = 1
    if (mutation === 'max-two') buff.target.max = 2
    if (mutation === 'no-special') Object.assign(buff.target, { hasSpecialPlay: undefined })
    if (mutation === 'black-only') buff.target.energyColor = 'black'
    if (mutation === 'arena-only') buff.target.keyword = 'arena'
    if (mutation === 'blocker-only') buff.target.blockerOnly = true
    if (mutation === 'level-limit') buff.target.maxLevel = 1
    if (mutation === 'rested-only') buff.target.restedOnly = true
    if (mutation === 'name-only') buff.target.cardName = 'Blueberry Cake Hound'
    if (mutation === 'source-only') buff.target.sourceOnly = true
    if (mutation === 'attack-target') buff.target.attackTargetOnly = true
    if (mutation === 'conditional-bonus') buff.condition = { kind: 'hand-count-at-most', count: 5 }
    if (mutation === 'ready-then') buff.thenEffects = [{ kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1 } }]
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  },
)
