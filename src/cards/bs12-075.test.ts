import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'

// Independent expectation from the complete physical print, recorded before adapter inspection.
const printed = "<Discard 1 card.> <Rest this Cookie.> If there are 5 cards or more in your opponent's hand, your opponent places 1 card from their hand into their trash."
const error = 'BS12-075 lacks paid one-hand discard and source REST Activate, opponent five-hand chosen discard or PP ordinary two'

describe.each([
  ['BS12-075', 'O-QkglxY-C2xmjtWKiO9BQ'],
  ['BS12-075@1', 'lCu0L2KS1SRaaS9Cp6gWiA'],
])('%s complete printed behavior', (number, image) => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  it('keeps exact costs, threshold, receiver choice and ordinary attack without adding Once', () => {
    const before = structuredClone(record)
    const converted = convertOfficialCardToGameCard(record)
    expect(converted).toMatchObject({ status: 'converted', gameCard: {
      type: 'cookie', name: 'Gnome Band', energyColor: 'purple', level: 2, hp: 3, keywords: ['arena'],
      imageUrl: `https://cookierunbraverse.com/data/en_storage/${image}.webp`,
      attack: 2, attackEnergyCost: { purple: 2 },
      skill: { trigger: 'activate', oncePerTurn: false, restSource: true, yourTurn: false, effectConditionsAtResolution: true,
        cost: { energy: {}, discardHand: 1 }, effects: [
          { kind: 'opponent-discard-hand', count: 1, condition: { kind: 'opponent-hand-count-at-least', count: 5 } },
        ] },
    } })
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Gnome Band')
    expect(converted.gameCard.skill?.text.replace(/\s+/g, ' ')).toContain(printed)
    expect(converted.gameCard.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(record, converted.gameCard).errors).not.toContain(error)
    expect(analyzeOfficialCardBehavior(record, converted.gameCard).contract.status).toBe('verified')
    expect(record).toEqual(before)
  })
  it.each(['threshold', 'amount', 'no-discard', 'no-rest', 'once', 'on-play', 'energy', 'colored-cost', 'ordinary', 'random', 'precondition'] as const)('blocks a changed printed contract: %s', mutation => {
    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.skill) throw new Error('Missing Gnome Band')
    const card = structuredClone(converted.gameCard)
    const skill = card.skill!
    const discard = skill.effects[0]
    if (discard.kind !== 'opponent-discard-hand') throw new Error('Missing chosen discard')
    if (mutation === 'threshold') discard.condition = { kind: 'opponent-hand-count-at-least', count: 6 }
    if (mutation === 'amount') discard.count = 2
    if (mutation === 'no-discard') delete skill.cost.discardHand
    if (mutation === 'no-rest') skill.restSource = false
    if (mutation === 'once') skill.oncePerTurn = true
    if (mutation === 'on-play') skill.trigger = 'on-play'
    if (mutation === 'energy') skill.cost.energy = { purple: 1 }
    if (mutation === 'colored-cost') skill.cost.discardHandColor = 'purple'
    if (mutation === 'ordinary') card.attackEnergyCost = { purple: 1, neutral: 1 }
    if (mutation === 'random') skill.effects = [{ kind: 'opponent-random-discard', count: 1 }]
    if (mutation === 'precondition') delete skill.effectConditionsAtResolution
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  })
})
