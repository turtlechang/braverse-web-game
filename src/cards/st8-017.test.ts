import { describe, expect, it } from 'vitest'
import { createCard } from '../game/starter-deck'
import { getCardPoolEntry } from '../game/card-pool'
import type { CardEffect, NonCookieCard } from '../game/types'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior as analyze } from './contracts/ledger'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw Error(`Missing ${label}`)
  return value
}

const raw: OfficialCardRecord = required(
  getCardPoolEntry('ST8-017'),
  'original Hindering Darkness',
)

const original = (): NonCookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'trap') throw Error('Hindering Darkness must be a Trap')
  return card
}

const converted = (): NonCookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st8-017-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'trap') {
    throw Error('Hindering Darkness must convert to Trap')
  }
  return result.gameCard
}

const trap = (card: NonCookieCard) => required(card.trap, 'Trap ability')
const attackReduction = (card: NonCookieCard) => {
  const effect = required(trap(card).effects[0], 'optional attack reduction')
  if (effect.kind !== 'modify-attack') throw Error('Expected attack reduction')
  return effect
}
const draw = (card: NonCookieCard) => {
  const effect = required(trap(card).effects[1], 'conditional Then draw')
  if (effect.kind !== 'draw-up-to') throw Error('Expected conditional draw')
  return effect
}

// Model the printed two-part Trap independently from the production adapter.
const expectedRuntime = (): NonCookieCard => {
  const card = original()
  const effects: CardEffect[] = [
    {
      kind: 'modify-attack',
      amount: -2,
      duration: 'this-turn',
      target: { side: 'opponent', min: 0, max: 1 },
    },
    {
      kind: 'draw-up-to',
      max: 1,
      condition: { kind: 'support-count-equal' },
    },
  ]
  card.trap = {
    cost: { energy: { green: 2 }, discardHand: 0 },
    text: required(raw.skill.text, 'printed effect text'),
    effects,
  }
  card.effects = structuredClone(effects)
  return card
}

const mutants: Record<string, (card: NonCookieCard) => void> = {
  'wrong identity': card => { card.name = 'Wind Archer Cookie' },
  'wrong color': card => { card.energyColor = 'red' },
  'missing Trap ability': card => { card.trap = undefined },
  'wrong energy cost': card => { trap(card).cost.energy = { green: 1, neutral: 1 } },
  'extra discard cost': card => { trap(card).cost.discardHand = 1 },
  'attack reduction made mandatory': card => { attackReduction(card).target!.min = 1 },
  'attack reduction increased': card => { attackReduction(card).amount = -3 },
  'attack reduction weakened': card => { attackReduction(card).amount = -1 },
  'attack reduction ends after battle': card => { Reflect.set(attackReduction(card), 'duration', 'current-battle') },
  'attack reduction targets own Cookies': card => { attackReduction(card).target!.side = 'self' },
  'attack reduction restricted to the attacker': card => { attackReduction(card).target!.attackTargetOnly = true },
  'Then draw made mandatory': card => { Reflect.set(draw(card), 'min', 1) },
  'Then draws two': card => { draw(card).max = 2 },
  'Then equality condition removed': card => { draw(card).condition = undefined },
  'Then requires unequal supports': card => { draw(card).condition = { kind: 'support-count-less-than-opponent', difference: 0 } },
  'Then compares only the opponent support count': card => { draw(card).condition = { kind: 'opponent-support-count-at-least', count: 2 } },
  'Then moved before attack reduction': card => { trap(card).effects.reverse() },
  'extra Trap effect': card => { trap(card).effects.push({ kind: 'draw', amount: 1 }) },
  'extra runtime mirror': card => { card.effects = [{ kind: 'draw', amount: 1 }] },
  'extra Item ability': card => { card.item = { text: '', cost: { energy: {}, discardHand: 0 }, effects: [] } },
  'extra FLIP': card => { card.flip = { text: 'Unprinted', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw', amount: 1 }] } },
  'extra keyword': card => { card.keywords = ['arena'] },
}

describe('ST8-017 original Hindering Darkness precise contract', () => {
  it('retains original green Trap identity and artwork', () => {
    const card = converted()
    expect([card.id, card.name, card.type, card.energyColor])
      .toEqual(['ST8-017', 'Hindering Darkness', 'trap', 'green'])
    expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/J1mdmMGqFu1Z8ZIGxFPw2Q.webp')
  })

  it('keeps GG, optional any-Cookie -2 through turn end, then conditional optional draw up to 1', () => {
    const card = converted(), ability = trap(card)
    expect(ability.cost).toEqual({ energy: { green: 2 }, discardHand: 0 })
    expect(ability.effects[0]).toEqual({
      kind: 'modify-attack', amount: -2, duration: 'this-turn',
      target: { side: 'opponent', min: 0, max: 1 },
    })
    expect(ability.effects[1]).toEqual({
      kind: 'draw-up-to', max: 1, condition: { kind: 'support-count-equal' },
    })
    expect(ability.effects).toEqual(card.effects)
    expect(card.item).toBeUndefined()
    expect(card.flip).toBeUndefined()
    expect(card.keywords ?? []).toEqual([])
  })

  it('verifies both the original official record and independently modeled runtime', () => {
    expect(analyze(raw).contract.status).toBe('verified')
    expect(analyze(raw, expectedRuntime()).contract.status).toBe('verified')
  })

  it('rejects semantic mutants while preserving the original source record', () => {
    expect(Object.keys(mutants)).toHaveLength(22)
    for (const [label, mutate] of Object.entries(mutants)) {
      const source = structuredClone(raw), card = expectedRuntime(), before = structuredClone(card)
      mutate(card)
      expect(card).not.toEqual(before)
      expect(analyze(raw, card).contract.status, label).not.toBe('verified')
      expect(raw).toEqual(source)
    }
  })
})
