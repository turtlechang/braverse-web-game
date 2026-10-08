import { describe, expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import { convertOfficialCardToExtraDeckCard, convertOfficialCardToGameCard } from './official-card-adapter'
import type { OfficialCardRecord } from './types'
import { materializeExtraDeckCookie } from '../game/extra-deck'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

// Original complete English card image was checked independently before conversion.
describe.each(['BS12-074', 'BS12-074@1'] as const)('%s independently checked printed EXTRA and top HP movement', number => {
  it('requires this-turn own battle Arena to own bottom, keeps second-player draw and BBB3 before the complete Then', () => {
    const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
    const snapshot = structuredClone(record)
    const converted = convertOfficialCardToExtraDeckCard(record)
    expect(convertOfficialCardToGameCard(record).status).toBe('unsupported')
    expect(converted).toMatchObject({ status: 'converted', extraDeckCard: {
      type: 'extra', name: 'Popping Candy Cookie', energyColor: 'blue', keywords: ['arena'], level: 3, hp: 5,
      attack: 3, attackEnergyCost: { blue: 3 }, extraDeckPlayMode: 'enter-battle',
      imageUrl: number === 'BS12-074' ? 'https://cookierunbraverse.com/data/en_storage/7gVOm1mP-zwQgPXFb0wn4Q.webp' : 'https://cookierunbraverse.com/data/en_storage/AbsJqaz4t_Ma4Eeziv4vBA.webp',
      playRequirement: { kind: 'arena-cookie-placed-from-battle-to-deck-bottom-this-turn', side: 'self' },
      skill: { trigger: 'on-play', oncePerTurn: false, yourTurn: false, restSource: false, cost: { energy: {} },
        effects: [{ kind: 'draw-up-to', max: 2, condition: { kind: 'player-started-second' } }] },
      attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: {} }, effects: [
        { kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena' }, addMatchedToHand: true,
          effects: [{ kind: 'field-to-deck-bottom', hpOnly: true, target: { side: 'opponent', min: 0, max: 1 } }] },
      ] }],
    } })
    if (converted.status !== 'converted') throw new Error('Missing Popping Candy EXTRA')
    expect(converted.extraDeckCard.extraDeckPlayCost).toBeUndefined()
    expect(converted.extraDeckCard.awakenRequirement).toBeUndefined()
    expect(converted.extraDeckCard.awakenHpBonus).toBeUndefined()
    expect(record).toEqual(snapshot)
  })
  it.each(['ordinary-cost', 'ordinary-damage', 'draw-three', 'no-second', 'discard-cost', 'no-required-bottom', 'wrong-level', 'body-move', 'own-hp', 'mandatory-target'] as const)('rejects a changed complete printed runtime: %s', mutation => {
    const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
    const converted = convertOfficialCardToExtraDeckCard(record)
    if (converted.status !== 'converted') throw new Error('Missing EXTRA')
    const card = structuredClone(materializeExtraDeckCookie(converted.extraDeckCard))
    const draw = card.skill!.effects[0]
    const then = card.attackEffects![0]
    if (draw.kind !== 'draw-up-to' || then.kind !== 'optional-cost-attack' || then.effects[0].kind !== 'reveal-bottom-deck' || then.effects[0].effects?.[0].kind !== 'field-to-deck-bottom') throw new Error('Missing complete effects')
    const reveal = then.effects[0]
    const move = reveal.effects![0]
    if (move.kind !== 'field-to-deck-bottom') throw new Error('Missing HP movement')
    if (mutation === 'ordinary-cost') card.attackEnergyCost = { blue: 2, neutral: 1 }
    if (mutation === 'ordinary-damage') card.attack = 2
    if (mutation === 'draw-three') draw.max = 3
    if (mutation === 'no-second') delete draw.condition
    if (mutation === 'discard-cost') then.cost.discardHand = 1
    if (mutation === 'no-required-bottom') delete reveal.requireCard
    if (mutation === 'wrong-level') reveal.match!.level = 3
    if (mutation === 'body-move') delete move.hpOnly
    if (mutation === 'own-hp') move.target.side = 'self'
    if (mutation === 'mandatory-target') move.target.min = 1
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-074 lacks precise own Arena battle-to-bottom EXTRA history, second-player up-to-two draws or BBB3 and matched-bottom return before optional opponent top HP to its owner bottom')
  })
})
