import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Complete English physical print, independently checked before conversion.
const printedSkill = '<Reveal 1 card from the bottom of your deck.> If that card is a LV.2 【Arena】 Cookie other than [DJ Miya], add it to your hand. Then, if there are 6 cards or more in your opponent\'s hand, your opponent places 1 card from their hand into their trash.'
const printedThen = 'Then, <discard 1 card.> Place this Cookie on the bottom of your deck.'

describe.each([
  ['BS12-073', 'https://cookierunbraverse.com/data/en_storage/xfOWxLcUUMOn_SIZEM2CPA.webp'],
  ['BS12-073@1', 'https://cookierunbraverse.com/data/en_storage/Ai_bEbhey8AJ5U8qFU-Nsw.webp'],
])('%s complete printed behavior', (number, imageUrl) => {
  it('keeps mandatory bottom reveal, exact same-name exclusion, independent opponent discard and paid source movement', () => {
    const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
    const before = structuredClone(record)
    const converted = convertOfficialCardToGameCard(record)
    expect(converted).toMatchObject({ status: 'converted', gameCard: {
      type: 'cookie', name: 'DJ Miya', energyColor: 'blue', level: 2, hp: 2, keywords: ['arena'],
      attack: 2, attackEnergyCost: { blue: 2 }, imageUrl,
      skill: { trigger: 'on-play', oncePerTurn: false, yourTurn: false, restSource: false, effectConditionsAtResolution: true, cost: { energy: {} }, effects: [
        { kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena', excludeCardName: 'DJ Miya' }, addMatchedToHand: true },
        { kind: 'opponent-discard-hand', count: 1, condition: { kind: 'opponent-hand-count-at-least', count: 6 } },
      ] },
      attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: {}, discardHand: 1 }, effects: [
        { kind: 'field-to-deck-bottom', target: { side: 'self', min: 1, max: 1, sourceOnly: true } },
      ] }],
    } })
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing DJ Miya')
    expect(converted.gameCard.skill?.text.replace(/\s+/g, ' ')).toContain(printedSkill)
    expect(converted.gameCard.attackText?.replace(/\s+/g, ' ')).toContain(printedThen)
    expect(record).toEqual(before)
  })
  it.each(['no-exclusion', 'wrong-threshold', 'nested-discard', 'no-discard-cost', 'other-source', 'precondition', 'wrong-ordinary', 'rest', 'once'] as const)('rejects a runtime that changes the printed independent contract: %s', mutation => {
    const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.skill) throw new Error('Missing DJ Miya')
    const card = structuredClone(converted.gameCard)
    const skill = card.skill!
    const reveal = skill.effects[0]
    const discard = skill.effects[1]
    const then = card.attackEffects![0]
    if (reveal.kind !== 'reveal-bottom-deck' || discard.kind !== 'opponent-discard-hand' || then.kind !== 'optional-cost-attack' || then.effects[0].kind !== 'field-to-deck-bottom') throw new Error('Missing effects')
    if (mutation === 'no-exclusion') delete reveal.match!.excludeCardName
    if (mutation === 'wrong-threshold') discard.condition = { kind: 'opponent-hand-count-at-least', count: 5 }
    if (mutation === 'nested-discard') { reveal.effects = [discard]; skill.effects = [reveal] }
    if (mutation === 'no-discard-cost') delete then.cost.discardHand
    if (mutation === 'other-source') delete then.effects[0].target.sourceOnly
    if (mutation === 'precondition') delete skill.effectConditionsAtResolution
    if (mutation === 'wrong-ordinary') card.attackEnergyCost = { blue: 1, neutral: 1 }
    if (mutation === 'rest') skill.restSource = true
    if (mutation === 'once') skill.oncePerTurn = true
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-073 lacks required exact non-DJ LV2 Arena bottom return, independent opponent six-hand discard or paid source-only bottom movement')
  })
})
