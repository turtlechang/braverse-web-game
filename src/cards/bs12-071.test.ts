import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Independently checked against each complete English print image.
const printedSkill = '【Activate】 【Once Per Turn】 Reveal 1 card from the bottom of your deck. If that card is a LV.2 【Arena】 Cookie, <place this Cookie in your trash.> Play that Cookie.'

describe.each([
  ['BS12-071', 'https://cookierunbraverse.com/data/en_storage/XctHmJF5Qt3R03tF1DPS2Q.webp'],
  ['BS12-071@1', 'https://cookierunbraverse.com/data/en_storage/85MnKfqLcLj6Wsu_THEkxA.webp'],
] as const)('%s physical card', (number, imageUrl) => {
  it('keeps free once-per-entry activation, reveal before conditional source cost, and the same bottom Cookie play', () => {
    const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
    const before = structuredClone(record)
    const converted = convertOfficialCardToGameCard(record)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('Missing Ice Pop')
    expect(converted.gameCard).toMatchObject({
      name: 'Ice Pop Cookie', type: 'cookie', energyColor: 'blue', keywords: ['arena'], level: 1, hp: 3, attack: 1,
      attackEnergyCost: { blue: 1, neutral: 1 },
      imageUrl,
      skill: { trigger: 'activate', oncePerTurn: true, restSource: false,
        cost: { energy: {} }, effects: [{ kind: 'reveal-bottom-deck',
          match: { type: 'cookie', level: 2, keyword: 'arena' }, playMatchedAfterSourceTrash: true }],
      },
    })
    if (converted.gameCard.type !== 'cookie') throw new Error('Missing Cookie')
    expect(converted.gameCard.attackEffects ?? []).toEqual([])
    expect(converted.gameCard.skill?.cost.selfToTrash).toBeUndefined()
    expect(converted.gameCard.skill?.text.replace(/\s+/g, ' ').trim()).toContain(printedSkill.replace(/\s+/g, ' ').trim())
    expect(record).toEqual(before)
    expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  })
  it.each(['no-skill', 'no-once', 'early-trash', 'energy', 'rest-source', 'wrong-level', 'no-arena', 'wrong-type', 'extra-color', 'draw', 'hand-return', 'missing-play', 'mismatch-moves', 'required-reveal', 'extra-effect', 'ordinary-damage', 'ordinary-cost'] as const)('rejects an incorrect runtime: %s', mutation => {
    const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
    const result = convertOfficialCardToGameCard(record)
    if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Ice Pop')
    const card = structuredClone(result.gameCard)
    const skill = card.skill!
    const reveal = skill.effects[0]
    if (reveal.kind !== 'reveal-bottom-deck' || !reveal.match) throw new Error('Missing reveal')
    if (mutation === 'no-skill') delete card.skill
    if (mutation === 'no-once') skill.oncePerTurn = false
    if (mutation === 'early-trash') skill.cost.selfToTrash = true
    if (mutation === 'energy') skill.cost.energy = { blue: 1 }
    if (mutation === 'rest-source') skill.restSource = true
    if (mutation === 'wrong-level') reveal.match.level = 3
    if (mutation === 'no-arena') delete reveal.match.keyword
    if (mutation === 'wrong-type') reveal.match.type = 'item'
    if (mutation === 'extra-color') Object.assign(reveal.match, { energyColor: 'blue' })
    if (mutation === 'draw') skill.effects = [{ kind: 'draw', amount: 1 }]
    if (mutation === 'hand-return') reveal.addMatchedToHand = true
    if (mutation === 'missing-play') delete reveal.playMatchedAfterSourceTrash
    if (mutation === 'mismatch-moves') reveal.otherwiseDestination = 'hand'
    if (mutation === 'required-reveal') reveal.requireCard = true
    if (mutation === 'extra-effect') reveal.effects = [{ kind: 'draw', amount: 1 }]
    if (mutation === 'ordinary-damage') card.attack = 2
    if (mutation === 'ordinary-cost') card.attackEnergyCost = { blue: 2 }
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-071 lacks free once-per-entry Activate, exact LV2 Arena bottom reveal before optional source trash cost and same bottom play')
  })
})
