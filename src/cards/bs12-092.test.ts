import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToExtraDeckCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Independent expectations read from both complete official card images.
it.each(['BS12-092', 'BS12-092@1'])('%s preserves EXTRA intersection, battle cost, friendly faint and second-player Then', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const original = structuredClone(record)
  const result = convertOfficialCardToExtraDeckCard(record)
  expect(result).toMatchObject({ status: 'converted', extraDeckCard: {
    id: 'BS12-092', name: 'Black Lemonade Cookie', type: 'extra', energyColor: 'purple', keywords: ['arena'],
    level: 3, hp: 5, attack: 4, attackCost: 4, attackEnergyCost: { purple: 4 }, extraDeckPlayMode: 'enter-battle',
    playRequirement: { kind: 'break-blocker-cookie-count-at-least', count: 3, keyword: 'arena' },
    extraDeckPlayCost: { energy: {}, trashBattleCookie: { count: 1, energyColor: 'purple', maxLevel: 2 } },
    skill: { trigger: 'passive', restSource: false, oncePerTurn: false, yourTurn: false, cost: { energy: {}, discardHand: 0 }, effects: [],
      friendlyFaintEffects: [{ kind: 'opponent-discard-hand', count: 1, condition: { kind: 'opponent-hand-count-at-least', count: 3 } }],
    },
    attackEffects: [{ kind: 'opponent-discard-hand', count: 1, condition: { kind: 'player-started-second' } }],
  } })
  if (result.status !== 'converted') throw new Error('Missing Black Lemonade EXTRA')
  expect(result.extraDeckCard.awakenRequirement).toBeUndefined()
  expect(result.extraDeckCard.awakenHpBonus).toBeUndefined()
  expect(result.extraDeckCard.skill?.faint).toBeUndefined()
  expect(result.extraDeckCard.imageUrl).toBe(number.includes('@')
    ? 'https://cookierunbraverse.com/data/en_storage/m9PGyIIxeRyPNgzq-rar_Q.webp'
    : 'https://cookierunbraverse.com/data/en_storage/xhkYJfDW2yAuju4wS0HZUw.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(original)
})

it.each(['free-entry', 'break-two', 'no-arena', 'wrong-mode', 'two-cost', 'cost-red', 'cost-lv3', 'cost-arena', 'cost-faint', 'cost-break', 'cost-hand', 'cost-energy',
  'no-listener', 'two-listeners', 'faint-two', 'hand-two', 'unconditional-faint', 'wrong-faint-zone', 'shared-passive', 'self-faint', 'REST', 'once', 'your-turn',
  'no-Then', 'Then-two', 'unconditional-Then', 'Then-three-hand', 'wrong-attack', 'wrong-HP'] as const)('092 strict rejects runtime semantic mutation: %s', mutation => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-092') as OfficialCardRecord
  const result = convertOfficialCardToExtraDeckCard(record)
  if (result.status !== 'converted') throw new Error('Missing Black Lemonade')
  const card = structuredClone(result.extraDeckCard)
  expect(analyzeOfficialCardBehavior(record, card).contract.status).toBe('verified')
  const skill = card.skill!
  const faint = skill.friendlyFaintEffects![0]
  const then = card.attackEffects![0]
  if (faint.kind !== 'opponent-discard-hand' || then.kind !== 'opponent-discard-hand' || card.playRequirement?.kind !== 'break-blocker-cookie-count-at-least') throw new Error('Missing physical effects')
  if (mutation === 'free-entry') delete card.extraDeckPlayCost
  if (mutation === 'break-two') card.playRequirement.count = 2
  if (mutation === 'no-arena') delete card.playRequirement.keyword
  if (mutation === 'wrong-mode') card.extraDeckPlayMode = 'awaken'
  if (mutation === 'two-cost') card.extraDeckPlayCost!.trashBattleCookie!.count = 2
  if (mutation === 'cost-red') card.extraDeckPlayCost!.trashBattleCookie!.energyColor = 'red'
  if (mutation === 'cost-lv3') card.extraDeckPlayCost!.trashBattleCookie!.maxLevel = 3
  if (mutation === 'cost-arena') card.extraDeckPlayCost!.trashBattleCookie!.keyword = 'arena'
  if (mutation === 'cost-faint') card.extraDeckPlayCost!.trashBattleCookie!.faint = true
  if (mutation === 'cost-break') card.extraDeckPlayCost!.trashBattleCookie!.toBreakArea = true
  if (mutation === 'cost-hand') card.extraDeckPlayCost!.discardHand = 1
  if (mutation === 'cost-energy') card.extraDeckPlayCost!.energy = { purple: 1 }
  if (mutation === 'no-listener') skill.friendlyFaintEffects = []
  if (mutation === 'two-listeners') skill.friendlyFaintEffects!.push(faint)
  if (mutation === 'faint-two') faint.count = 2
  if (mutation === 'hand-two') faint.condition = { kind: 'opponent-hand-count-at-least', count: 2 }
  if (mutation === 'unconditional-faint') delete faint.condition
  if (mutation === 'wrong-faint-zone') faint.destination = 'deck-top'
  if (mutation === 'shared-passive') skill.effects = [faint]
  if (mutation === 'self-faint') skill.faint = true
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'no-Then') card.attackEffects = []
  if (mutation === 'Then-two') then.count = 2
  if (mutation === 'unconditional-Then') delete then.condition
  if (mutation === 'Then-three-hand') then.condition = { kind: 'opponent-hand-count-at-least', count: 3 }
  if (mutation === 'wrong-attack') card.attackEnergyCost = { purple: 3, neutral: 1 }
  if (mutation === 'wrong-HP') card.hp = 4
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-092 lacks three own Break Arena Blocker Cookies, purple LV2-or-lower battle-to-trash EXTRA cost, living friendly-faint three-hand opponent discard or independent second-player PPPP four Then')
})
