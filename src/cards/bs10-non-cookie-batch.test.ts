import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
  getRuntimeKeywords,
} from './official-card-adapter'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from './official-effect-adapter'
import type { OfficialCardRecord } from './types'

const cards = (JSON.parse(readFileSync(
  'data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json',
  'utf8',
)) as { cards: OfficialCardRecord[] }).cards
const findCard = (number: string) => {
  const card = cards.find((candidate) => candidate.cardNumber === `BS10-${number}`)
  if (!card) throw new Error(`Missing BS10-${number}`)
  return card
}

const effectsOf = (number: string) => {
  const result = convertOfficialCardEffects(findCard(number))
  expect(result.status, `BS10-${number} should be supported`).toBe('supported')
  if (result.status !== 'supported') throw new Error(result.reason)
  return result.effects
}

describe('BS10 non-cookie adapter mappings', () => {
  it.each([
    ['013', [{ kind: 'modify-attack', amount: -1 }, { kind: 'damage', amount: 1 }]],
    ['015', [{ kind: 'modify-attack', amount: -3 }, { kind: 'discard-hand', count: 1 }, { kind: 'damage', amount: 1 }]],
    ['017', [{ kind: 'draw-up-to', max: 1 }, { kind: 'hp-to-trash', amount: 2 }]],
    ['018', [{ kind: 'hp-to-trash', amount: 1 }, { kind: 'damage', amount: 1 }]],
    ['062', [{ kind: 'support-to-hp', selectTarget: true }]],
    ['063', [{ kind: 'support-to-trash', side: 'self' }, { kind: 'support-to-trash', side: 'opponent' }]],
    ['065', [{ kind: 'support-to-hand', amount: 1 }, { kind: 'hand-to-support', amount: 1 }]],
    ['066', [{ kind: 'draw-up-to-then-discard', max: 3, discardCount: 1 }]],
    ['112', [{ kind: 'deck-to-trash', amount: 5 }, { kind: 'damage', amount: 1 }]],
    ['120', [{ kind: 'deck-to-trash', amount: 5 }, { kind: 'draw', amount: 1 }, { kind: 'damage', amount: 1 }]],
  ])('%s preserves the ordered supported effects', (number, expected) => {
    expect(effectsOf(number)).toMatchObject(expected)
  })

  it('keeps conditional attack and damage effects precise', () => {
    expect(effectsOf('013')[1]).toMatchObject({ target: { minRemainingHp: 2 } })
    expect(effectsOf('037')[0]).toMatchObject({ condition: { kind: 'cookie-gained-hp-this-turn' } })
    expect(effectsOf('042')[0]).toMatchObject({ thenEffects: [{ condition: { kind: 'break-level-at-least', level: 5 } }] })
    expect(effectsOf('086')[0]).toMatchObject({ thenEffects: [{ condition: { kind: 'hand-count-at-least', count: 7 } }] })
    expect(effectsOf('113')[0]).toMatchObject({ thenEffects: [{ condition: { kind: 'refreshed-during-game' } }] })
    expect(effectsOf('116')[0]).toMatchObject({ thenEffects: [{ target: { keyword: 'beast' } }] })
    expect(effectsOf('038')[0]).toMatchObject({
      thenEffects: [{
        target: { previousEffectTargetOnly: true },
        condition: { kind: 'previous-effect-target-hp-above-original' },
      }],
    })
    expect(effectsOf('035')[0]).toMatchObject({ kind: 'gain-hp', amount: 1 })
    expect(convertOfficialTrapAbility(findCard('015'))?.cost).toEqual({ energy: { red: 3 }, discardHand: 0 })
    expect(convertOfficialTrapAbility(findCard('042'))?.condition).toBeUndefined()
    expect(convertOfficialTrapAbility(findCard('042'))?.effects[0]).toMatchObject({
      thenEffects: [{ condition: { kind: 'break-level-at-least', level: 5 } }],
    })
  })

  it('preserves the BS10-067 rested-support threshold and BS10-068 named-source choice', () => {
    const bridgeSkill = convertOfficialStageAbility(findCard('019'))
    expect(bridgeSkill?.cost).toEqual({ energy: { red: 1 }, discardHand: 1 })

    const bridge = convertOfficialStageAbility(findCard('067'))
    expect(bridge?.effects).toEqual([{
      kind: 'set-active',
      supportCount: 1,
      selectable: true,
      optional: true,
      condition: { kind: 'support-count-at-least', count: 7, restedOnly: true },
    }])

    expect(effectsOf('068')).toEqual([
      {
        kind: 'choose-one',
        modes: [
          {
            label: 'Place White Lily Cookie from your hand in your support area as rested.',
            effects: [{ kind: 'hand-to-support', amount: 1, cardName: 'White Lily Cookie', rested: true }],
          },
          {
            label: 'Place White Lily Cookie from your trash in your support area as rested.',
            effects: [{ kind: 'trash-to-support', amount: 1, cardName: 'White Lily Cookie', rested: true }],
          },
        ],
      },
      { kind: 'draw-up-to', max: 1 },
    ])
  })

  it('does not duplicate Clover support return as an ability cost', () => {
    expect(convertOfficialCookieSkill(findCard('058'))?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(effectsOf('058')).toMatchObject([
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'hand-to-support', amount: 1, energyColor: 'green', rested: true },
    ])
  })

  it('keeps mill five in the ordered skill effects for BS10-120 and BS10-122', () => {
    expect(convertOfficialCookieSkill(findCard('120'))?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(convertOfficialCookieSkill(findCard('120'))?.effects).toMatchObject([
      { kind: 'deck-to-trash', amount: 5, side: 'self' },
      { kind: 'draw', amount: 1 },
      { kind: 'damage', amount: 1 },
    ])
    expect(convertOfficialCookieSkill(findCard('122'))?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(convertOfficialCookieSkill(findCard('122'))?.effects).toEqual([
      { kind: 'deck-to-trash', amount: 5, side: 'self' },
      { kind: 'draw-up-to', max: 2 },
    ])
  })

  it('maps the three EXTRA clauses without inventing missing HP values', () => {
    const warden = convertOfficialCardToExtraDeckCard(findCard('048'))
    expect(warden.status).toBe('converted')
    if (warden.status === 'converted') {
      expect(warden.extraDeckCard.playRequirement).toMatchObject({ kind: 'all-of' })
      expect(warden.extraDeckCard.skill?.effects).toEqual([{
        kind: 'damage-all',
        amount: 1,
        side: 'either',
        sequential: true,
        target: { side: 'either', min: 0, max: 4 },
      }])
      expect(warden.extraDeckCard.attackEffects).toEqual([{
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'opponent-next-turn',
        damageType: 'effect',
        target: { side: 'self', min: 0, max: 4, allMatching: true },
      }])
    }
    const guildmaster = convertOfficialCardToExtraDeckCard(findCard('098'))
    expect(guildmaster.status).toBe('converted')
    if (guildmaster.status === 'converted') {
      expect(guildmaster.extraDeckCard.extraDeckPlayCost).toMatchObject({ discardHand: 2, discardHandColor: 'blue' })
      expect(guildmaster.extraDeckCard.attackEffects).toEqual([{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      }])
    }
    const warmaster = convertOfficialCardToExtraDeckCard(findCard('123'))
    expect(warmaster.status).toBe('converted')
    if (warmaster.status === 'converted') {
      expect(warmaster.extraDeckCard.extraDeckPlayCost).toMatchObject({ discardHand: 2 })
      expect(warmaster.extraDeckCard.attackEffects).toEqual([{
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      }])
    }
  })

  it('converts the HP+1 Awakened Hollyberry and White Lily EXTRA cards', () => {
    const hollyberry = convertOfficialCardToExtraDeckCard(findCard('024'))
    expect(hollyberry).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        extraDeckPlayMode: 'awaken',
        level: 3,
        hp: 1,
        awakenHpBonus: 1,
        awakenRequirement: { targetName: 'Hollyberry Cookie', maxRemainingHp: 3 },
        extraDeckPlayCost: { energy: {}, discardHand: 1 },
        skill: {
          trigger: 'on-play',
          effects: [{
            kind: 'modify-damage-received',
            amount: -1,
            duration: 'opponent-next-turn',
            damageType: 'all',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          }],
        },
        attackEffects: [{
          kind: 'optional-cost-attack',
          cost: { energy: { red: 2 }, discardHand: 0 },
          effects: [{ kind: 'damage', amount: 2 }],
        }],
      },
    })

    const whiteLily = convertOfficialCardToExtraDeckCard(findCard('073'))
    expect(whiteLily).toMatchObject({
      status: 'converted',
      extraDeckCard: {
        extraDeckPlayMode: 'awaken',
        level: 3,
        hp: 1,
        awakenHpBonus: 1,
        awakenRequirement: { targetName: 'White Lily Cookie' },
        playRequirement: { kind: 'support-count-at-least', count: 8 },
        attackEffects: [{
          kind: 'optional-cost-attack',
          cost: { energy: {}, supportToHand: 1, supportToHandType: 'cookie' },
          effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
        }],
      },
    })
  })

  it('maps official Beast keywords for BS10-116 targeting', () => {
    expect(getRuntimeKeywords(findCard('116'))).toContain('beast')
    expect(convertOfficialCardToGameCard(findCard('116')).status).toBe('converted')
  })
})
