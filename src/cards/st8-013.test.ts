import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st8-013.en.json'
import { createCard } from '../game/starter-deck'
import type { GameCard } from '../game/types'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior as analyze } from './contracts/ledger'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw Error(`Missing ${label}`)
  return value
}

const raw = required(
  (document.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST8-013'),
  'original Windgrass',
)
type ItemCard = GameCard & { type: 'item' }

const converted = (): ItemCard => {
  const result = convertOfficialCardToGameCard(raw, 'st8-013-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'item') {
    throw Error('Windgrass must convert to Item')
  }
  return result.gameCard as ItemCard
}

const original = (): ItemCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'item') throw Error('Windgrass must be Item')
  return card as ItemCard
}

const item = (card: ItemCard) => required(card.item, 'Item ability')
const rest = (card: ItemCard) => {
  const effect = required(item(card).effects[0], 'opponent support REST')
  if (effect.kind !== 'rest-support') throw Error('Expected optional opponent support REST')
  return effect
}
const ready = (card: ItemCard) => {
  const effect = required(item(card).effects[1], 'conditional support ready')
  if (effect.kind !== 'set-active') throw Error('Expected selectable support ready')
  return effect
}

const mutants: Record<string, (card: ItemCard) => void> = {
  'wrong name': card => { card.name = 'Windcatcher' },
  'wrong card color': card => { card.cardColor = 'red' },
  'wrong energy color': card => { card.energyColor = 'red' },
  'extra keyword': card => { card.keywords = ['arena'] },
  'missing item ability': card => { card.item = undefined },
  'green payment omitted': card => { item(card).cost.energy = {} },
  'payment color changed': card => { item(card).cost.energy = { neutral: 1 } },
  'extra payment color': card => { item(card).cost.energy = { green: 1, red: 1 } },
  'discard cost added': card => { item(card).cost.discardHand = 1 },
  'extra item cost': card => { Reflect.set(item(card).cost, 'supportToTrash', 1) },
  'first effect omitted': card => { item(card).effects.shift() },
  'first effect changed to self': card => { rest(card).side = 'self' },
  'REST count changed': card => { rest(card).amount = 2 },
  'REST made mandatory': card => { rest(card).optional = false },
  'REST active-only restriction added': card => { rest(card).activeOnly = true },
  'REST energy filter added': card => { rest(card).energyColor = 'green' },
  'REST condition added': card => { rest(card).condition = { kind: 'support-count-at-least', count: 1 } },
  'second effect omitted': card => { item(card).effects.pop() },
  'ready count changed': card => { ready(card).supportCount = 2 },
  'ready not selectable': card => { ready(card).selectable = false },
  'ready made mandatory': card => { ready(card).optional = false },
  'ready rested-only added': card => { ready(card).restedOnly = true },
  'ready energy filter added': card => { ready(card).energyColor = 'green' },
  'ready condition omitted': card => { ready(card).condition = undefined },
  'ready name changed': card => { ready(card).condition = { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Kiwi Cookie' } },
  'ready side changed': card => { ready(card).condition = { kind: 'battle-area-has-named-cookie', side: 'opponent', name: 'Wind Archer Cookie' } },
  'ready condition moved to hand': card => { ready(card).condition = { kind: 'support-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' } },
  'extra effect added': card => { item(card).effects.push({ kind: 'draw', amount: 1 }) },
  'main effect mirror omitted': card => { card.effects = [] },
  'extra FLIP added': card => { card.flip = { text: 'Unprinted FLIP', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw', amount: 1 }] } },
}

describe('ST8-013 independently transcribed Windgrass original printing', () => {
  it('retains the original green Item and its printed art', () => {
    const card = converted()
    expect([card.id, card.name, card.type, card.cardColor ?? card.energyColor, card.energyColor])
      .toEqual(['ST8-013', 'Windgrass', 'item', 'green', 'green'])
    expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/KBslBhLdmzu7p99sYUPGAg.webp')
  })

  it('pays fixed G, then offers opponent REST followed by conditional selectable own support ready', () => {
    const card = converted()
    const expected = [
      { kind: 'rest-support', side: 'opponent', amount: 1, optional: true },
      {
        kind: 'set-active', supportCount: 1, selectable: true, optional: true, restedOnly: false,
        condition: { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
      },
    ]
    expect(item(card).cost).toEqual({ energy: { green: 1 }, discardHand: 0 })
    expect(item(card).effects).toEqual(expected)
    expect(card.effects).toEqual(expected)
    expect(card.flip).toBeUndefined()
    expect(card.trap).toBeUndefined()
    expect(card.stageAbility).toBeUndefined()
  })

  it('verifies the raw official record and createCard runtime instance', () => {
    const audit = analyze(raw)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.payments).toEqual([{ kind: 'energy', energy: { green: 1 }, clauseIds: ['skill-1'] }])
    expect(analyze(raw, original()).contract.status).toBe('verified')
  })

  it('rejects exact-contract mutations without altering the raw printing', () => {
    expect(Object.keys(mutants)).toHaveLength(30)
    for (const [label, mutate] of Object.entries(mutants)) {
      const card = original()
      mutate(card)
      expect(analyze(raw, card).contract.status, label).not.toBe('verified')
    }
    expect(raw.name).toBe('Windgrass')
  })
})
