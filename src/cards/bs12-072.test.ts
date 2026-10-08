import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Independent transcription of both complete English physical prints.
const skillText = 'Place up to 1 other LV.2 or lower 【Arena】 Cookie from your battle area on the bottom of your deck.'
const thenText = 'Then, <discard 1 card.> <Reveal 1 card from the bottom of your deck.> If that card is a LV.2 【Arena】 Cookie, add it to your hand, and deals 1 damage.'

describe.each([
  ['BS12-072', 'https://cookierunbraverse.com/data/en_storage/RQYFaY2SdSRISO1nGLBQ_g.webp'],
  ['BS12-072@1', 'https://cookierunbraverse.com/data/en_storage/FC5QIwLHijIRNrCuZuM-6A.webp'],
] as const)('%s confirmed skill and R004 full attack continuation', (number, imageUrl) => {
  it('pays B once per turn without resting source, moving only optional other own LV2-or-lower Arena', () => {
    const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
    const before = structuredClone(record)
    const converted = convertOfficialCardToGameCard(record)
    expect(converted).toMatchObject({ status: 'converted', gameCard: {
      type: 'cookie', name: 'Cream Soda Cookie', energyColor: 'blue', keywords: ['arena'], level: 2, hp: 3,
      attack: 2, attackEnergyCost: { blue: 2 }, imageUrl,
      skill: { trigger: 'activate', oncePerTurn: true, restSource: false, cost: { energy: { blue: 1 } },
        effects: [{ kind: 'field-to-deck-bottom', target: { side: 'self', min: 0, max: 1, maxLevel: 2, keyword: 'arena', excludeSource: true } }] },
    } })
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Cream Soda')
    expect(converted.gameCard.skill?.text.replace(/\s+/g, ' ')).toContain(skillText)
    expect(converted.gameCard.attackText?.replace(/\s+/g, ' ')).toContain(thenText)
    expect(converted.gameCard.attackEffects).toEqual([{ kind: 'optional-cost-attack', cost: { energy: {}, discardHand: 1 }, effectText: converted.gameCard.attackText,
      effects: [{ kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena' }, addMatchedToHand: true,
        effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true } }] }] }])
    const audit = analyzeOfficialCardBehavior(record)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.blockers).toEqual([])
    expect(record).toEqual(before)
  })
  it.each(['missing', 'free', 'wrong-energy', 'rest-source', 'no-once', 'wrong-timing', 'opponent', 'source', 'no-keyword', 'wrong-level', 'mandatory', 'two', 'extra-color', 'extra-cost', 'guess-then', 'ordinary-damage', 'ordinary-cost', 'underlay-guess'] as const)('rejects incorrect runtime: %s', mutation => {
    const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.skill) throw new Error('Missing Cream Soda')
    const card = structuredClone(converted.gameCard)
    const skill = card.skill!
    const move = skill.effects[0]
    if (move.kind !== 'field-to-deck-bottom') throw new Error('Missing movement')
    if (mutation === 'missing') delete card.skill
    if (mutation === 'free') skill.cost.energy = {}
    if (mutation === 'wrong-energy') skill.cost.energy = { neutral: 1 }
    if (mutation === 'rest-source') skill.restSource = true
    if (mutation === 'no-once') skill.oncePerTurn = false
    if (mutation === 'wrong-timing') skill.trigger = 'on-play'
    if (mutation === 'opponent') move.target.side = 'opponent'
    if (mutation === 'source') delete move.target.excludeSource
    if (mutation === 'no-keyword') delete move.target.keyword
    if (mutation === 'wrong-level') move.target.maxLevel = 3
    if (mutation === 'mandatory') move.target.min = 1
    if (mutation === 'two') move.target.max = 2
    if (mutation === 'extra-color') move.target.energyColor = 'blue'
    if (mutation === 'extra-cost') skill.cost.discardHand = 1
    if (mutation === 'guess-then') card.attackEffects = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }]
    if (mutation === 'ordinary-damage') card.attack = 3
    if (mutation === 'ordinary-cost') card.attackEnergyCost = { blue: 1, neutral: 1 }
    if (mutation === 'underlay-guess') move.deferAwakenedUnderlay = true
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(mutation === 'guess-then'
      ? 'BS12-072 lacks R004 discard one, required matching LV2 Arena bottom to hand, then one damage on original defender'
      : 'BS12-072 lacks B1 Activate once-per-entry, exact optional other own LV2-or-lower Arena Cookie to deck bottom or BB ordinary two')
  })
})
