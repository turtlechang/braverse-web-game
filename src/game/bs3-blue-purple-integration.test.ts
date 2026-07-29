import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialStageAbility,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  executeCardEffect,
  getEffectTargetCandidates,
} from './effects'
import type {
  CardEffect,
  ChooseOneEffect,
  DamageEffect,
  EffectContext,
  GameState,
  RevealTopDeckEffect,
} from './types'
import { cookie, createBattleState } from './test-helpers/battle-helpers'

const findBs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )
  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

const effectsOf = (cardNumber: string): CardEffect[] => {
  const conversion = convertOfficialCardEffects(findBs3Card(cardNumber))
  if (conversion.status !== 'supported') {
    throw new Error(`${cardNumber} should convert to runtime effects.`)
  }
  return conversion.effects
}

const sourceContext = (sourceCardName = 'source'): EffectContext => ({
  sourcePlayerId: 'player-one',
  sourceInstanceId: sourceCardName,
  sourceCardName,
})

// =====================================
// BLUE CARDS (BS3-073 ~ BS3-096)
// =====================================
describe('BS3 藍色卡片整合測試', () => {
  it('BS3-077 Madeleine Cookie: skill deals 1 damage then set-active', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-077'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.cost.energy).toEqual({ blue: 1 })
    expect(skill!.effects).toHaveLength(2)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
    })
    expect(skill!.effects[1]).toMatchObject({
      kind: 'set-active',
      supportCount: 0,
    })
  })

  it('BS3-077 skill can deal damage to opponent cookie', () => {
    const state = createBattleState()
    const p2Cookie = cookie('p2-cookie')
    const withOpponent: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            { card: p2Cookie, hpCards: [], rested: false, battleEntryId: 'p2-cookie:battle:1' },
          ],
        },
      },
    }
    const effect = effectsOf('BS3-077')[0] as DamageEffect
    const targets = getEffectTargetCandidates(withOpponent, sourceContext(), effect.target)
    expect(targets).toContainEqual(
      expect.objectContaining({ card: expect.objectContaining({ instanceId: 'p2-cookie' }) }),
    )
  })

  it('BS3-087 Clotted Cream Cookie: reveal-top-deck conditional damage', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-087'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.cost.energy).toEqual({ blue: 1 })
    expect(skill!.effects).toHaveLength(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'reveal-top-deck',
      match: { type: 'cookie', energyColor: 'blue', level: 2 },
    })
    const revealEffect = skill!.effects[0] as RevealTopDeckEffect
    expect(revealEffect.effects).toHaveLength(1)
    expect(revealEffect.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
    })
  })

  it('BS3-087 skill does nothing when top card does not match', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-087'))
    expect(skill).toBeTruthy()
    const revealEffect = skill!.effects[0] as RevealTopDeckEffect
    expect(revealEffect.kind).toBe('reveal-top-deck')
    expect(revealEffect.match).toEqual({ type: 'cookie', energyColor: 'blue', level: 2 })
    expect(revealEffect.effects).toHaveLength(1)
  })

  it('BS3-096 Peaceful Vanilla Kingdom: stage attack draws when hand ≤ 2', () => {
    const stageSkill = convertOfficialStageAbility(findBs3Card('BS3-096'))
    expect(stageSkill).toBeTruthy()
    expect(stageSkill!.effects[0]).toMatchObject({
      kind: 'draw',
      amount: 2,
      condition: { kind: 'hand-count-at-most', count: 2 },
    })
  })
})

// =====================================
// PURPLE CARDS (BS3-097 ~ BS3-121)
// =====================================
describe('BS3 紫色卡片整合測試', () => {
  it('BS3-097 Licorice Cookie: on-play deals 1 damage then mills 1', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-097'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.energy).toEqual({ purple: 2 })
    expect(skill!.effects).toHaveLength(2)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
    })
    expect(skill!.effects[1]).toMatchObject({
      kind: 'deck-to-trash',
      amount: 1,
      side: 'opponent',
    })
  })

  it('BS3-098 Kumiho Cookie: on-play damage with energy cost', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-098'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.energy).toEqual({ purple: 1 })
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
    })
  })

  it('BS3-104 Pomegranate Cookie: skill discards 2 then opponent draws 2', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-104'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.cost.energy).toEqual({ purple: 2 })
    expect(skill!.effects).toHaveLength(2)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'opponent-random-discard',
      count: 2,
    })
    expect(skill!.effects[1]).toMatchObject({
      kind: 'draw',
      amount: 2,
      side: 'opponent',
    })
  })

  it('BS3-109 Werewolf Cookie: on-play gains +1 HP', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-109'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.energy).toEqual({ purple: 1 })
    expect(skill!.effects[0]).toMatchObject({
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1 },
    })
  })

  it('BS3-119 Roiling Licorice Sea: stage attack mills 3 opponent cards', () => {
    const stageSkill = convertOfficialStageAbility(findBs3Card('BS3-119'))
    expect(stageSkill).toBeTruthy()
    expect(stageSkill!.effects[0]).toMatchObject({
      kind: 'deck-to-trash',
      amount: 3,
      side: 'opponent',
    })
  })

  it('BS3-120 Resolute Dark Cacao Kingdom: choose-one attack', () => {
    const stageSkill = convertOfficialStageAbility(findBs3Card('BS3-120'))
    expect(stageSkill).toBeTruthy()
    expect(stageSkill!.effects).toHaveLength(1)
    const chooseOne = stageSkill!.effects[0] as ChooseOneEffect
    expect(chooseOne.kind).toBe('choose-one')
    expect(chooseOne.modes).toHaveLength(2)
    expect(chooseOne.modes[0].effects[0]).toMatchObject({
      kind: 'deck-to-trash',
      amount: 2,
      side: 'self',
    })
    expect(chooseOne.modes[1].effects[0]).toMatchObject({
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 1,
      filterColor: 'purple',
      optionalPick: true,
      restDestination: 'trash',
    })
    expect(chooseOne.modes[1].effects[1]).toMatchObject({
      kind: 'stage-source-to-trash',
    })
  })

  it('BS3-120 mode 1 puts 2 cards from deck to trash', () => {
    const state = createBattleState()
    const stageSkill = convertOfficialStageAbility(findBs3Card('BS3-120'))
    const effect = stageSkill!.effects[0] as ChooseOneEffect
    const modeEffect = effect.modes[0].effects[0]
    const beforeTrash = state.players['player-one'].discardPile.length
    const beforeDeck = state.players['player-one'].deck.length
    const next = executeCardEffect(state, sourceContext(), modeEffect, [])
    expect(next.players['player-one'].discardPile.length).toBe(beforeTrash + 2)
    expect(next.players['player-one'].deck.length).toBe(beforeDeck - 2)
  })
})
