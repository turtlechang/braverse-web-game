import { describe, expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const printedAttack = '<{B}{B}> Shining Star {da} 2\nThen, <reveal 1 card from the bottom of your deck.> If that card is a LV.2 【Arena】 Cookie, add it to your hand, and all of your opponent\'s Cookies receive 1 damage.'
describe.each(['BS12-070', 'BS12-070@1'] as const)('%s independent printed attack contract', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const imageUrl = number === 'BS12-070'
    ? 'https://cookierunbraverse.com/data/en_storage/72cuFfsiIhjGpF5g1ISRYw.webp'
    : 'https://cookierunbraverse.com/data/en_storage/So-W7uu2r8hT5OuwFqf2gQ.webp'
  const convert = () => {
    const result = convertOfficialCardToGameCard(record)
    if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Stardust Cookie')
    return result.gameCard
  }
  it('BS12-070 matches printed BB ordinary two then optional required bottom reveal, exact LV2 Arena return and all opponent damage', () => {
    const snapshot = structuredClone(record)
    const card = convert()
    expect(card).toMatchObject({ name: 'Stardust Cookie', type: 'cookie', energyColor: 'blue', keywords: ['arena'], level: 2, hp: 2, attack: 2,
      attackEnergyCost: { blue: 2 }, imageUrl,
      attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: {} },
        effects: [{ kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena' }, addMatchedToHand: true,
          effects: [{ kind: 'damage-all', amount: 1, side: 'opponent', sequential: true, target: { side: 'opponent', min: 1, max: 2 } }] }] }] })
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects).toHaveLength(1)
    const then = card.attackEffects![0]
    if (then.kind !== 'optional-cost-attack') throw new Error('Missing Then')
    expect(then.effectText.replace(/\s+/g, ' ').trim()).toBe(printedAttack.replace(/\s+/g, ' ').trim())
    expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
    expect(record).toEqual(snapshot)
  })
  it.each(['ordinary-one', 'one-blue', 'extra-energy', 'mandatory', 'extra-then-cost', 'no-reveal', 'optional-reveal', 'no-return', 'wrong-level', 'no-arena', 'no-cookie', 'extra-color', 'extra-condition', 'mismatch-moves', 'single-target', 'two-damage', 'self-side', 'no-order', 'optional-target', 'filtered-target', 'extra-skill', 'source-energy', 'missing-text'] as const)('fails closed for incorrect BS12-070 runtime: %s', mutation => {
    const card = structuredClone(convert())
    const then = card.attackEffects![0]
    if (then.kind !== 'optional-cost-attack') throw new Error('Missing Then')
    const reveal = then.effects[0]
    if (reveal.kind !== 'reveal-bottom-deck' || !reveal.match) throw new Error('Missing reveal')
    const match = reveal.match
    const damage = reveal.effects![0]
    if (damage.kind !== 'damage-all' || !damage.target) throw new Error('Missing all damage')
    if (mutation === 'ordinary-one') card.attack = 1
    if (mutation === 'one-blue') card.attackEnergyCost!.blue = 1
    if (mutation === 'extra-energy') card.attackEnergyCost!.green = 1
    if (mutation === 'mandatory') then.mandatory = true
    if (mutation === 'extra-then-cost') then.cost.discardHand = 1
    if (mutation === 'no-reveal') then.effects = [damage]
    if (mutation === 'optional-reveal') delete reveal.requireCard
    if (mutation === 'no-return') delete reveal.addMatchedToHand
    if (mutation === 'wrong-level') match.level = 3
    if (mutation === 'no-arena') delete match.keyword
    if (mutation === 'no-cookie') match.type = 'item'
    if (mutation === 'extra-color') Object.assign(match, { energyColor: 'blue' })
    if (mutation === 'extra-condition') reveal.condition = { kind: 'support-count-at-least', count: 3 }
    if (mutation === 'mismatch-moves') reveal.otherwiseDestination = 'hand'
    if (mutation === 'single-target') reveal.effects = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }]
    if (mutation === 'two-damage') damage.amount = 2
    if (mutation === 'self-side') damage.side = 'self'
    if (mutation === 'no-order') delete damage.sequential
    if (mutation === 'optional-target') damage.target.min = 0
    if (mutation === 'filtered-target') damage.target.energyColor = 'blue'
    if (mutation === 'extra-skill') card.skill = { trigger: 'activate', cost: { energy: {} }, effects: [{ kind: 'draw', amount: 1 }], text: 'wrong', oncePerTurn: false, yourTurn: false, restSource: false }
    if (mutation === 'source-energy') then.sourceEnergy = { blue: 1 }
    if (mutation === 'missing-text') then.effectText = ''
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-070 lacks BB ordinary two and optional required bottom reveal, exact same LV2 Arena Cookie to hand then all opponents ordered one damage')
  })
})
