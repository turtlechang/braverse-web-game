import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-088', 'BS12-088@1'])('%s keeps independently read Blocker and faint clauses separate', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-088', name: 'Black Sapphire Cookie', energyColor: 'purple',
    level: 1, hp: 3, attack: 1, attackCost: 2, attackEnergyCost: { purple: 1, neutral: 1 }, keywords: ['arena'],
    skill: { trigger: 'block', restSource: false, oncePerTurn: false, yourTurn: false, faint: true,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
      faintCost: { energy: {}, discardHand: 1, discardHandKeyword: 'arena' },
      faintEffects: [{ kind: 'draw-up-to', max: 2 }],
    } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Black Sapphire')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe(number.includes('@')
    ? 'https://cookierunbraverse.com/data/en_storage/BmbTL6qOySyYAiwFMmgp9g.webp'
    : 'https://cookierunbraverse.com/data/en_storage/7aD4MGbX8u7pthr44ilo_A.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})

it.each(['free-block', 'wrong-block-count', 'no-block-color', 'no-block-arena', 'block-cookie-only', 'block-energy', 'REST', 'once', 'your-turn',
  'activate', 'no-redirect', 'opponent', 'no-faint', 'no-faint-effects', 'redirect-at-faint', 'draw-one', 'draw-three', 'conditional-draw',
  'free-faint', 'double-faint-cost', 'purple-faint', 'no-faint-arena', 'faint-cookie-only', 'faint-energy', 'shared-effects', 'extra-faint', 'wrong-attack'] as const)(
  '088 strict rejects actual changed runtime clause: %s', mutation => {
    const source = candidate.cards.find(card => card.cardNumber === 'BS12-088') as OfficialCardRecord
    const result = convertOfficialCardToGameCard(source)
    if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Black Sapphire')
    const card = structuredClone(result.gameCard)
    const skill = card.skill!
    if (mutation === 'free-block') skill.cost.discardHand = 0
    if (mutation === 'wrong-block-count') skill.cost.discardHand = 2
    if (mutation === 'no-block-color') delete skill.cost.discardHandColor
    if (mutation === 'no-block-arena') delete skill.cost.discardHandKeyword
    if (mutation === 'block-cookie-only') skill.cost.discardHandType = 'cookie'
    if (mutation === 'block-energy') skill.cost.energy = { purple: 1 }
    if (mutation === 'REST') skill.restSource = true
    if (mutation === 'once') skill.oncePerTurn = true
    if (mutation === 'your-turn') skill.yourTurn = true
    if (mutation === 'activate') skill.trigger = 'activate'
    if (mutation === 'no-redirect') skill.effects = []
    if (mutation === 'opponent' && skill.effects[0]?.kind === 'redirect-attack') skill.effects[0].target.side = 'opponent'
    if (mutation === 'no-faint') skill.faint = false
    if (mutation === 'no-faint-effects') delete skill.faintEffects
    if (mutation === 'redirect-at-faint') skill.faintEffects = structuredClone(skill.effects)
    const draw = skill.faintEffects?.[0]
    if (mutation === 'draw-one' && draw?.kind === 'draw-up-to') draw.max = 1
    if (mutation === 'draw-three' && draw?.kind === 'draw-up-to') draw.max = 3
    if (mutation === 'conditional-draw' && draw?.kind === 'draw-up-to') draw.condition = { kind: 'hand-count-at-most', count: 3 }
    if (mutation === 'free-faint') skill.faintCost!.discardHand = 0
    if (mutation === 'double-faint-cost') skill.faintCost!.discardHand = 2
    if (mutation === 'purple-faint') skill.faintCost!.discardHandColor = 'purple'
    if (mutation === 'no-faint-arena') delete skill.faintCost!.discardHandKeyword
    if (mutation === 'faint-cookie-only') skill.faintCost!.discardHandType = 'cookie'
    if (mutation === 'faint-energy') skill.faintCost!.energy = { purple: 1 }
    if (mutation === 'shared-effects') skill.effects.push({ kind: 'draw-up-to', max: 2 })
    if (mutation === 'extra-faint') skill.faintEffects!.push({ kind: 'draw-up-to', max: 1 })
    if (mutation === 'wrong-attack') card.attackEnergyCost = { neutral: 2 }
    expect(analyzeOfficialCardBehavior(source, card).errors).toContain('BS12-088 lacks PN ordinary one, purple Arena hand Blocker and independent any-color Arena hand-cost faint draw up to two')
  },
)
