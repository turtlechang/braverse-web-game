import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-089', 'BS12-089@1'])('%s retains both independently read Lone Wolf clauses', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-089', name: 'Werewolf Cookie', energyColor: 'purple',
    level: 2, hp: 5, attack: 2, attackCost: 3, attackEnergyCost: { purple: 2, neutral: 1 }, keywords: ['arena'],
    skill: { trigger: 'block', restSource: false, oncePerTurn: false, yourTurn: false,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
      battleOpponentAttackEffectPrevention: { level: 3 },
    } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Werewolf')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.skill?.faintEffects).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe(number.includes('@')
    ? 'https://cookierunbraverse.com/data/en_storage/36lvHbt0i7kFadEB6RmReg.webp'
    : 'https://cookierunbraverse.com/data/en_storage/6GqQx7x1rCQTKtToSRagrw.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})

it.each(['free-block', 'double-block', 'no-color', 'no-arena', 'cookie-only', 'energy', 'REST', 'once', 'your-turn', 'activate',
  'no-redirect', 'opponent-redirect', 'no-prevention', 'level-two', 'level-five', 'extra-draw', 'faint', 'wrong-attack', 'wrong-hp'] as const)(
  '089 strict rejects changed runtime semantics: %s', mutation => {
    const source = candidate.cards.find(card => card.cardNumber === 'BS12-089') as OfficialCardRecord
    const result = convertOfficialCardToGameCard(source)
    if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Werewolf')
    const card = structuredClone(result.gameCard)
    const skill = card.skill!
    if (mutation === 'free-block') skill.cost.discardHand = 0
    if (mutation === 'double-block') skill.cost.discardHand = 2
    if (mutation === 'no-color') delete skill.cost.discardHandColor
    if (mutation === 'no-arena') delete skill.cost.discardHandKeyword
    if (mutation === 'cookie-only') skill.cost.discardHandType = 'cookie'
    if (mutation === 'energy') skill.cost.energy = { purple: 1 }
    if (mutation === 'REST') skill.restSource = true
    if (mutation === 'once') skill.oncePerTurn = true
    if (mutation === 'your-turn') skill.yourTurn = true
    if (mutation === 'activate') skill.trigger = 'activate'
    if (mutation === 'no-redirect') skill.effects = []
    if (mutation === 'opponent-redirect' && skill.effects[0]?.kind === 'redirect-attack') skill.effects[0].target.side = 'opponent'
    if (mutation === 'no-prevention') delete skill.battleOpponentAttackEffectPrevention
    if (mutation === 'level-two') skill.battleOpponentAttackEffectPrevention = { level: 2 }
    if (mutation === 'level-five') skill.battleOpponentAttackEffectPrevention = { level: 5 }
    if (mutation === 'extra-draw') skill.effects.push({ kind: 'draw-up-to', max: 1 })
    if (mutation === 'faint') skill.faint = true
    if (mutation === 'wrong-attack') card.attackEnergyCost = { purple: 3 }
    if (mutation === 'wrong-hp') card.hp = 4
    expect(analyzeOfficialCardBehavior(source, card).errors).toContain('BS12-089 lacks PPN ordinary two, purple Arena hand Blocker or battle-only opponent exact LV3 attack-effect prevention')
  },
)
