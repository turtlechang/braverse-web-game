import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-012.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'
import type { CardSkill } from '../game/types'
import { getCardPoolEntry } from '../game/card-pool'

// Independent transcription of original English ST6-012 Picky Pyro-tiger.
const raw = document.cards.find(c => c.cardNumber === 'ST6-012') as OfficialCardRecord
const printed: CardSkill = { trigger: 'activate', oncePerTurn: true, yourTurn: false,
  restSource: false, cost: { energy: { red: 1 }, discardHand: 0 }, text: raw.skill.text ?? '',
  effects: [{ kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, cardName: 'Fire Spirit Cookie' } }] }
describe('ST6-012 original named-Cookie HP skill', () => {
  it('keeps red LV1 HP2, RR ordinary two, no Then or FLIP', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack])
      .toEqual(['Picky Pyro-tiger', 'red', 1, 2, 2])
    expect(card.attackEnergyCost).toEqual({ red: 2 })
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
  })
  it('requires R once to give zero or one own Fire Spirit Cookie one HP without REST', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(card.skill).toMatchObject(printed)
    expect(card.skill?.effects).toEqual(printed.effects)
  })
  it('binds the independently specified named target in strict audit', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified')
    expect(analyzeOfficialCardBehavior(raw, { ...card, skill: printed }).contract.status).toBe('verified')
    expect(analyzeOfficialCardBehavior(raw, { ...card, skill: undefined }).contract.status).not.toBe('verified')
  })
  it.each(['missing-name', 'wrong-name', 'opponent', 'mandatory', 'two-targets', 'blue-cost', 'free', 'two-hp', 'rest-source', 'no-once'] as const)(
    'strict rejects target mutation %s', mutation => {
      const skill = structuredClone(printed), target = skill.effects[0]
      if (target.kind !== 'gain-hp' || !target.target) throw new Error('Expected HP effect and selector')
      if (mutation === 'missing-name') delete target.target.cardName
      if (mutation === 'wrong-name') target.target.cardName = 'Habanero Cookie'
      if (mutation === 'opponent') target.target.side = 'opponent'
      if (mutation === 'mandatory') target.target.min = 1
      if (mutation === 'two-targets') target.target.max = 2
      if (mutation === 'blue-cost') skill.cost.energy = { blue: 1 }
      if (mutation === 'free') skill.cost.energy = {}
      if (mutation === 'two-hp') target.amount = 2
      if (mutation === 'rest-source') skill.restSource = true
      if (mutation === 'no-once') skill.oncePerTurn = false
      expect(analyzeOfficialCardBehavior(raw, { ...createCard(raw, 'player-one', 1), skill }).contract.status)
        .not.toBe('verified')
    },
  )
  it.each(['BS5-014','BS5-014@1','BS10-019'])('preserves the printed named target in existing %s contract', id => {
    const reference = getCardPoolEntry(id)
    if (!reference) throw new Error('Missing formal reference')
    const report = analyzeOfficialCardBehavior(reference)
    expect(report.contract.status).toBe('verified')
    expect(report.contract.targets[0].selector).toEqual({side:id==='BS10-019'?'self':'opponent',min:0,max:1,
      cardName:id==='BS10-019'?'Hollyberry Cookie':'Pitaya Dragon Cookie'})
  })
})
