import { describe, expect, it } from 'vitest'
import document from '../../data/candidates/st6-st10/official-st8.en.json'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import type { CookieCard } from '../game/types'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior as analyze } from './contracts/ledger'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === null || value === undefined) throw Error(`Missing ${label}`)
  return value
}

const raw: OfficialCardRecord = required(
  getCardPoolEntry('ST8-012') ??
    (document.cards as OfficialCardRecord[]).find((card) => card.cardNumber === 'ST8-012'),
  'original Windcatcher',
)

const converted = (): CookieCard => {
  const result = convertOfficialCardToGameCard(raw, 'st8-012-contract')
  if (result.status !== 'converted' || result.gameCard?.type !== 'cookie') {
    throw Error('Windcatcher must convert to Cookie')
  }
  return result.gameCard
}

const original = (): CookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'cookie') throw Error('Windcatcher must be Cookie')
  return card
}

const skill = (card: CookieCard) => required(card.skill, 'Activate skill')
const damage = (card: CookieCard) => {
  const effect = required(skill(card).effects[0], 'conditional damage')
  if (effect.kind !== 'damage') throw Error('Expected conditional damage')
  return effect
}
const optionalThen = (card: CookieCard) => {
  const effect = required(skill(card).effects[1], 'optional Then')
  if (effect.kind !== 'optional-cost-attack') throw Error('Expected optional Then')
  return effect
}
const gainHp = (card: CookieCard) => {
  const effect = required(optionalThen(card).effects[0], 'Wind Archer HP gain')
  if (effect.kind !== 'gain-hp') throw Error('Expected HP gain')
  return effect
}
const gainHpTarget = (card: CookieCard) => required(gainHp(card).target, 'Wind Archer target')

const mutants: Record<string, (card: CookieCard) => void> = {
  'wrong name': (card) => { card.name = 'Wind Archer Cookie' },
  'wrong color': (card) => { card.cardColor = 'yellow' },
  'wrong energy color': (card) => { card.energyColor = 'yellow' },
  'wrong LV': (card) => { card.level = 2 },
  'wrong HP': (card) => { card.hp = 3 },
  'wrong ordinary damage': (card) => { card.attack = 1 },
  'wrong total attack cost': (card) => { card.attackCost = 3 },
  'wrong ordinary attack energy': (card) => { card.attackEnergyCost = { green: 1, neutral: 1 } },
  'extra attack energy color': (card) => { card.attackEnergyCost = { green: 2, red: 1 } },
  'missing Activate': (card) => { card.skill = undefined },
  'wrong trigger': (card) => { skill(card).trigger = 'block' },
  'damage condition blocks activation': (card) => { skill(card).effectConditionsAtResolution = false },
  'Once per Turn': (card) => { skill(card).oncePerTurn = true },
  'Your Turn': (card) => { skill(card).yourTurn = true },
  'missing source REST': (card) => { skill(card).restSource = false },
  'extra activation energy': (card) => { skill(card).cost.energy = { green: 1 } },
  'discard-hand activation cost': (card) => { skill(card).cost.discardHand = 1 },
  'extra activation cost': (card) => { Reflect.set(skill(card).cost, 'supportToTrash', 1) },
  'damage condition omitted': (card) => { damage(card).condition = undefined },
  'damage condition reversed to opponent Item': (card) => { damage(card).condition = { kind: 'item-activated-this-turn', side: 'opponent' } as never },
  'damage amount changed': (card) => { damage(card).amount = 2 },
  'damage side changed': (card) => { damage(card).target.side = 'self' },
  'damage made mandatory target': (card) => { damage(card).target.min = 1 },
  'damage target filter added': (card) => { Reflect.set(damage(card).target, 'maxLevel', 2) },
  'Then omitted': (card) => { skill(card).effects.pop() },
  'Then misclassified as attack': (card) => { optionalThen(card).resolution = 'attack' },
  'Then made mandatory': (card) => { optionalThen(card).mandatory = true },
  'Then pays before condition': (card) => { optionalThen(card).payBeforeCondition = true },
  'source Cookie used as Then energy': (card) => { optionalThen(card).sourceEnergy = { green: 1 } },
  'Then has a second condition': (card) => { Reflect.set(optionalThen(card), 'condition', { kind: 'item-activated-this-turn' }) },
  'Then energy changed': (card) => { optionalThen(card).cost.energy = { neutral: 1 } },
  'Then discard cost added': (card) => { optionalThen(card).cost.discardHand = 1 },
  'Then adds extra effect': (card) => { optionalThen(card).effects.push({ kind: 'draw', amount: 1 }) },
  'Then HP amount changed': (card) => { gainHp(card).amount = 2 },
  'Then HP target side changed': (card) => { gainHpTarget(card).side = 'opponent' },
  'Then target made mandatory': (card) => { gainHpTarget(card).min = 1 },
  'Then target count increased': (card) => { gainHpTarget(card).max = 2 },
  'Then target name changed': (card) => { gainHpTarget(card).cardName = 'Windcatcher' },
  'Then target color filter added': (card) => { Reflect.set(gainHpTarget(card), 'cardColor', 'green') },
  'Then target level filter added': (card) => { Reflect.set(gainHpTarget(card), 'minLevel', 3) },
  'Then target source-only restriction added': (card) => { gainHpTarget(card).sourceOnly = true },
  'extra skill clause': (card) => { skill(card).effects.push({ kind: 'draw', amount: 1 }) },
  'missing main effect mirror': (card) => { card.effects = [] },
  'extra attack Then': (card) => { card.attackEffects = [{ kind: 'draw', amount: 1 }] },
  'extra FLIP': (card) => { card.flip = { text: 'Unprinted FLIP', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw', amount: 1 }] } },
  'extra keyword': (card) => { card.keywords = ['arena'] },
  'extra On Play clause': (card) => { skill(card).onPlayEffects = [{ kind: 'draw', amount: 1 }] },
  'extra faint clause': (card) => { skill(card).faintEffects = [{ kind: 'draw', amount: 1 }] },
  'extra passive clause': (card) => { skill(card).passiveEffects = [{ kind: 'draw', amount: 1 }] },
}

describe('ST8-012 independently transcribed Windcatcher original printing', () => {
  it('retains the original green LV1 HP2 GG ordinary2 and artwork', () => {
    const card = converted()
    expect([card.id, card.name, card.cardColor, card.energyColor, card.level, card.hp, card.attack, card.attackCost])
      .toEqual(['ST8-012', 'Windcatcher', 'green', 'green', 1, 2, 2, 2])
    expect(card.attackEnergyCost).toEqual({ green: 2 })
    expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/Y46FLWRPFn4vDp37eklcvA.webp')
  })

  it('preserves REST Activate, the current-turn Item condition, and the independent optional G Then', () => {
    const card = converted()
    const ability = skill(card)
    const expected = [
      {
        kind: 'damage', amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'item-activated-this-turn' },
      },
      {
        kind: 'optional-cost-attack', resolution: 'ability',
        cost: { energy: { green: 1 }, discardHand: 0 },
        effectText: 'Then, <can be used as {G}.> Select up to 1 of your [Wind Archer Cookie]. That Cookie gains +1 HP.',
        effects: [{
          kind: 'gain-hp', amount: 1,
          target: { side: 'self', min: 0, max: 1, cardName: 'Wind Archer Cookie' },
        }],
      },
    ]
    expect([ability.trigger, ability.oncePerTurn, ability.yourTurn, ability.restSource, ability.effectConditionsAtResolution])
      .toEqual(['activate', false, false, true, true])
    expect(ability.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(ability.effects).toEqual(expected)
    expect(card.effects).toEqual(expected)
    expect(card.flip).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.keywords ?? []).toEqual([])
    expect(ability.onPlayEffects).toBeUndefined()
    expect(ability.faintEffects).toBeUndefined()
    expect(ability.passiveEffects).toBeUndefined()
  })

  it('verifies the raw official record and the createCard runtime card', () => {
    expect(analyze(raw).contract.status).toBe('verified')
    const card = original()
    expect(card.cardColor).toBeUndefined()
    expect(analyze(raw, card).contract.status).toBe('verified')
  })

  it('rejects every exact-contract mutation without altering the raw printing', () => {
    expect(Object.keys(mutants)).toHaveLength(49)
    for (const [label, mutate] of Object.entries(mutants)) {
      const card = original()
      mutate(card)
      expect(analyze(raw, card).contract.status, label).not.toBe('verified')
    }
    expect(raw.name).toBe('Windcatcher')
  })
})
