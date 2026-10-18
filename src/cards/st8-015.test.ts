import { describe, expect, it } from 'vitest'
import { createCard } from '../game/starter-deck'
import { getCardPoolEntry } from '../game/card-pool'
import type { CardAbility, CardEffect, NonCookieCard } from '../game/types'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior as analyze } from './contracts/ledger'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw Error(`Missing ${label}`)
  return value
}

const raw: OfficialCardRecord = required(
  getCardPoolEntry('ST8-015'),
  'original Essence of the Tempest',
)

const original = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'item') throw Error('Essence of the Tempest must be an Item')
  return card
}

const converted = (): NonCookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st8-015-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'item') {
    throw Error('Essence of the Tempest must convert to Item')
  }
  return result.gameCard
}

const ability = (card: NonCookieCard): CardAbility => required(card.item, 'Item ability')
const choice = (card: NonCookieCard) => {
  const effect = required(ability(card).effects[0], 'conditional placement choice')
  if (effect.kind !== 'choose-one') throw Error('Expected conditional choose-one')
  return effect
}
const placement = (card: NonCookieCard, modeIndex: number) => {
  const effect = required(required(choice(card).modes[modeIndex], 'placement mode').effects[0], 'placement')
  if (effect.kind !== 'deck-to-support') throw Error('Expected deck-to-support')
  return effect
}
const then = (card: NonCookieCard) => {
  const effect = required(ability(card).effects[1], 'support-to-hand Then')
  if (effect.kind !== 'support-to-hand') throw Error('Expected support-to-hand Then')
  return effect
}

// Model the printed behavior independently from the adapter's runtime mapping.
const expectedRuntime = (): NonCookieCard => {
  const card = original()
  const effects: CardEffect[] = [
    {
      kind: 'choose-one',
      condition: { kind: 'any-of', conditions: [
        { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
        { kind: 'support-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
      ] },
      modes: [
        { label: 'Place 1 card rested', effects: [{ kind: 'deck-to-support', amount: 1, rested: true }] },
        { label: 'Place 0 cards', effects: [{ kind: 'deck-to-support', amount: 0, rested: true }] },
      ],
    },
    { kind: 'support-to-hand', amount: 1, optional: true },
  ]
  card.item = {
    cost: { energy: { green: 2 }, discardHand: 0 },
    allowInactiveConditionalEffects: true,
    text: required(raw.skill.text, 'printed effect text'),
    effects,
  }
  card.effects = structuredClone(effects)
  return card
}

const mutants: Record<string, (card: NonCookieCard) => void> = {
  'wrong name': card => { card.name = 'Wind Archer Cookie' },
  'wrong energy color': card => { card.energyColor = 'yellow' },
  'missing Item ability': card => { card.item = undefined },
  'wrong cost': card => { ability(card).cost.energy = { green: 1, neutral: 1 } },
  'extra cost': card => { ability(card).cost.discardHand = 1 },
  'conditional effect blocks activation': card => { ability(card).allowInactiveConditionalEffects = false },
  'missing condition': card => { choice(card).condition = undefined },
  'condition only checks battle area': card => {
    choice(card).condition = { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' }
  },
  'condition checks opponent battle area': card => {
    choice(card).condition = { kind: 'battle-area-has-named-cookie', side: 'opponent', name: 'Wind Archer Cookie' }
  },
  'condition checks opponent support area': card => {
    choice(card).condition = { kind: 'support-area-has-named-cookie', side: 'opponent', name: 'Wind Archer Cookie' }
  },
  'wrong witness name': card => {
    choice(card).condition = { kind: 'any-of', conditions: [
      { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Windcatcher' },
      { kind: 'support-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
    ] }
  },
  'extra witness condition': card => {
    Reflect.set(choice(card).condition!, 'difference', 0)
  },
  'missing zero mode': card => { choice(card).modes.splice(1, 1) },
  'missing one mode': card => { choice(card).modes.splice(0, 1) },
  'third mode': card => { choice(card).modes.push({ label: 'Draw', effects: [{ kind: 'draw', amount: 1 }] }) },
  'one mode places no card': card => { placement(card, 0).amount = 0 },
  'zero mode places a card': card => { placement(card, 1).amount = 1 },
  'placed card enters active': card => { placement(card, 0).rested = false },
  'zero mode has extra placement': card => { choice(card).modes[1].effects.push({ kind: 'draw', amount: 1 }) },
  'placement restricted to Cookies': card => { Reflect.set(placement(card, 0), 'cardType', 'cookie') },
  'placement restricted to green': card => { Reflect.set(placement(card, 0), 'energyColor', 'green') },
  'Then omitted': card => { ability(card).effects.pop() },
  'Then made mandatory': card => { then(card).optional = false },
  'Then returns two supports': card => { then(card).amount = 2 },
  'Then returns only Items': card => { then(card).cardType = 'item' },
  'Then returns opponent support': card => { then(card).side = 'opponent' },
  'Then condition added': card => { then(card).condition = { kind: 'support-count-at-least', count: 5 } },
  'Then moved before placement': card => { ability(card).effects.reverse() },
  'extra Item effect': card => { ability(card).effects.push({ kind: 'draw', amount: 1 }) },
  'extra skill mirror': card => { card.effects = [{ kind: 'draw', amount: 1 }] },
  'extra FLIP': card => { card.flip = { text: 'Unprinted', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw', amount: 1 }] } },
  'extra keyword': card => { card.keywords = ['arena'] },
}

describe('ST8-015 original Essence of the Tempest precise contract', () => {
  it('retains original green Item identity and artwork', () => {
    const card = converted()
    expect([card.id, card.name, card.type, card.energyColor])
      .toEqual(['ST8-015', 'Essence of the Tempest', 'item', 'green'])
    expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/GS3p2bZJ4mcK-CxlwhEeGg.webp')
  })

  it('keeps GG cost, both Wind Archer locations, optional rested top-card 0/1 and independent optional Then', () => {
    const card = converted(), item = ability(card), condition = choice(card).condition
    expect(item.cost).toEqual({ energy: { green: 2 }, discardHand: 0 })
    expect(item.allowInactiveConditionalEffects).toBe(true)
    expect(condition).toEqual({ kind: 'any-of', conditions: [
      { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
      { kind: 'support-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
    ] })
    expect(choice(card).modes.map(mode => mode.effects)).toEqual([
      [{ kind: 'deck-to-support', amount: 1, rested: true }],
      [{ kind: 'deck-to-support', amount: 0, rested: true }],
    ])
    expect(then(card)).toEqual({ kind: 'support-to-hand', amount: 1, optional: true })
    expect(item.effects).toEqual(card.effects)
    expect(card.flip).toBeUndefined()
    expect(card.keywords ?? []).toEqual([])
  })

  it('verifies both the original official record and independently modeled runtime', () => {
    expect(analyze(raw).contract.status).toBe('verified')
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
  })

  it('rejects every semantic mutant without altering the original source record', () => {
    expect(Object.keys(mutants)).toHaveLength(32)
    for (const [label, mutate] of Object.entries(mutants)) {
      const source = structuredClone(raw), card = expectedRuntime(), before = structuredClone(card)
      mutate(card)
      expect(card).not.toEqual(before)
      expect(analyze(raw, card).contract.status, label).not.toBe('verified')
      expect(raw).toEqual(source)
    }
  })
})
