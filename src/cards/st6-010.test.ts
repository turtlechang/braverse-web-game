import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-010.en.json'
import type { OfficialCardRecord } from './types'
import type { CardSkill } from '../game/types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'
import { getCardPoolEntry } from '../game/card-pool'

// Independent transcription: original English ST6-010 Peperoncino Cookie.
const raw = document.cards.find(card => card.cardNumber === 'ST6-010') as OfficialCardRecord
const printedSkill: CardSkill = {
  text: "【Blocker】 <{R}> (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.)",
  trigger: 'block', oncePerTurn: false, yourTurn: false, restSource: false,
  cost: { energy: { red: 1 }, discardHand: 0 },
  effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
}
const mutations: [string, (skill: CardSkill) => CardSkill][] = [
  ['wrong trigger', skill => ({ ...skill, trigger: 'passive' })],
  ['missing redirect', skill => ({ ...skill, effects: [] })],
  ['opponent redirect', skill => ({ ...skill, effects: [{ kind: 'redirect-attack', target: { side: 'opponent', min: 1, max: 1 } }] })],
  ['blue payment', skill => ({ ...skill, cost: { energy: { blue: 1 }, discardHand: 0 } })],
  ['extra Once', skill => ({ ...skill, oncePerTurn: true })],
  ['extra Once Per Game', skill => ({ ...skill, oncePerGame: true })],
  ['extra Your Turn', skill => ({ ...skill, yourTurn: true })],
  ['extra REST', skill => ({ ...skill, restSource: true })],
  ['extra discard', skill => ({ ...skill, cost: { ...skill.cost, discardHand: 1 } })],
]

describe('ST6-010 original Peperoncino Cookie', () => {
  it('keeps red LV1 HP3 and RN ordinary one, without attack Then or FLIP', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected original Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack])
      .toEqual(['Peperoncino Cookie', 'red', 1, 3, 1])
    expect(card.attackEnergyCost).toEqual({ red: 1, neutral: 1 })
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
  })
  it('converts the printed full-width Blocker to R source-only redirect', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(card.skill).toMatchObject(printedSkill)
    expect(card.skill?.effects).toEqual(printedSkill.effects)
  })
  it('requires actual runtime Blocker evidence in strict audit', () => {
    const card = createCard(raw, 'player-one', 1)
    const good = analyzeOfficialCardBehavior(raw, { ...card, skill: printedSkill })
    expect(good.contract.status).toBe('verified')
    expect(good.contract.timing.markers).toContain('bl')
    const missing = analyzeOfficialCardBehavior(raw, { ...card, skill: undefined })
    expect(missing.contract.status).not.toBe('verified')
  })
  it.each(mutations)('rejects %s despite the ordinary attack also paying red', (_, mutate) => {
    const card = createCard(raw, 'player-one', 1)
    const audit = analyzeOfficialCardBehavior(raw, { ...card, skill: mutate(printedSkill) })
    expect(audit.contract.status).not.toBe('verified')
    expect(audit.errors.length).toBeGreaterThan(0)
  })
  it.each(['BS2-028', 'BS12-077', 'BS12-083'])('does not treat %s referencing Blocker as its own Blocker', id => {
    const reference = getCardPoolEntry(id)
    if (!reference) throw new Error(`Missing original printing ${id}`)
    expect(analyzeOfficialCardBehavior(reference).contract.timing.markers).not.toContain('bl')
  })
})
