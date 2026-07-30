import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  executeCardEffect,
  getEffectTargetCandidates,
} from './effects'
import type { CardEffect, CookieCard, EffectContext, GameState } from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

const findBs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (c) => c.cardNumber === cardNumber,
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

const levelledCookie = (
  instanceId: string,
  level: number,
  energyColor: CookieCard['energyColor'] = 'green',
): CookieCard => ({ ...cookie(instanceId), level, energyColor })

const sourceContext = (sourceCardName = 'source'): EffectContext => ({
  sourcePlayerId: 'player-two',
  sourceInstanceId: 'attacker',
  sourceCardName,
})

const withAlly = (
  state: GameState,
  allyCard: CookieCard,
  hpCards: string[],
  rested = false,
): GameState => ({
  ...state,
  players: {
    ...state.players,
    'player-two': {
      ...state.players['player-two'],
      battleArea: [
        ...state.players['player-two'].battleArea,
        {
          card: allyCard,
          hpCards: hpCards.map((id) => item(id)),
          rested,
          battleEntryId: `${allyCard.instanceId}:battle:9`,
        },
      ],
    },
  },
})

const withSupport = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
  cards: { id: string; rested?: boolean }[],
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: {
      ...state.players[playerId],
      supportArea: [
        ...state.players[playerId].supportArea,
        ...cards.map((c) => ({ card: item(c.id), rested: c.rested ?? false })),
      ],
    },
  },
})

const withOpponentAlly = (
  state: GameState,
  allyCard: CookieCard,
  hpCards: string[],
  rested = false,
): GameState => ({
  ...state,
  players: {
    ...state.players,
    'player-one': {
      ...state.players['player-one'],
      battleArea: [
        ...state.players['player-one'].battleArea,
        {
          card: allyCard,
          hpCards: hpCards.map((id) => item(id)),
          rested,
          battleEntryId: `${allyCard.instanceId}:battle:8`,
        },
      ],
    },
  },
})

describe('BS3-049 Carrot Cookie: vanilla attacker', () => {
  it('has no skill effect', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-049'))
    expect(skill).toBeFalsy()
  })
})

describe('BS3-050 Matcha Cookie: activate damage with support 7+', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-050'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      condition: { kind: 'support-count-at-least', count: 7 },
    })
  })
})

describe('BS3-051 Fig Cookie: passive modify-attack -1', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-051'))
    expect(skill).toBeTruthy()
    expect(skill!.oncePerTurn).toBe(true)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: -1,
      duration: 'this-turn',
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })
})

describe('BS3-052 Mint Choco Cookie: on-play gain-hp', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-052'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.supportToTrash).toBe(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'gain-hp',
      amount: 1,
      target: {
        side: 'self',
        min: 0,
        max: 1,
        excludeSource: true,
        remainingHp: 2,
      },
    })
  })
})

describe('BS3-053 Butter Roll Cookie: set-cookie-active', () => {
  it('converts correctly', () => {
    expect(effectsOf('BS3-053')).toEqual([
      {
        kind: 'set-cookie-active',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          excludeSource: true,
          energyColor: 'green',
          restedOnly: true,
        },
      },
    ])
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-053'))
    expect(skill?.trigger).toBe('activate')
    expect(skill?.oncePerTurn).toBe(true)
    expect(skill?.cost.supportToTrash).toBe(1)
  })

  it('only offers rested green allies as candidates', () => {
    let state = withAlly(
      createBattleState(),
      levelledCookie('rested-green', 1, 'green'),
      ['rested-green-hp'],
      true,
    )
    state = withAlly(state, levelledCookie('active-green', 1, 'green'), ['active-green-hp'])
    state = withAlly(state, levelledCookie('rested-blue', 1, 'blue'), ['rested-blue-hp'], true)

    const [effect] = effectsOf('BS3-053')
    if (effect.kind !== 'set-cookie-active') throw new Error('unexpected effect')

    expect(
      getEffectTargetCandidates(state, sourceContext(), effect.target).map(
        (entry) => entry.card.instanceId,
      ),
    ).toEqual(['rested-green'])
  })

  it('sets the selected ally active', () => {
    const state = withAlly(
      createBattleState(),
      levelledCookie('rested-green', 1, 'green'),
      ['rested-green-hp'],
      true,
    )

    const next = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-053')[0],
      ['rested-green'],
    )

    expect(next.players['player-two'].battleArea[1].rested).toBe(false)
  })
})

describe('BS3-054 Beet Cookie: end-of-turn draw with active-support condition', () => {
  it('converts correctly', () => {
    expect(effectsOf('BS3-054')).toEqual([
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'active-support-count-at-least', count: 2 },
      },
    ])
  })
})

describe('BS3-055 White Lily Cookie: OnPlay support-to-hp + attack Then', () => {
  it('skill converts to support-to-hp', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-055'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'support-to-hp',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      energyColor: 'green',
      optional: true,
    })
  })
})

describe('BS3-056 Pinecone Cookie: flip gain-hp', () => {
  it('flip converts correctly', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-056'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({
      kind: 'gain-hp',
      amount: 1,
    })
  })
})

describe('BS3-057 Mercurial Knight Cookie: on-play damage with support 5+', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-057'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })
})

describe('BS3-058 Avocado Cookie: flip draw-up-to', () => {
  it('flip converts correctly', () => {
    const flip = convertOfficialFlipAbility(findBs3Card('BS3-058'))
    expect(flip).toBeTruthy()
    expect(flip!.effects[0]).toMatchObject({
      kind: 'draw-up-to',
      max: 1,
    })
  })
})

describe('BS3-059 Onion Cookie: vanilla attacker', () => {
  it('has no skill effect', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-059'))
    expect(skill).toBeFalsy()
  })
})

describe('BS3-060 Elder Faerie Cookie: OnPlay rest-support + attack Then', () => {
  it('skill converts to rest-support', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-060'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'rest-support',
      side: 'opponent',
      amount: 1,
      activeOnly: true,
      optional: true,
    })
  })
})

describe('BS3-061 Silverbell Cookie: faint damage-all with support 5+', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-061'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('passive')
    expect(skill!.cost.supportToTrash).toBe(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })

  it('damage-all targets all opponent cookies', () => {
    let state = createBattleState()
    state = withSupport(state, 'player-two', Array.from({ length: 6 }, (_, i) => ({ id: `sup-${i}` })))
    state = withOpponentAlly(state, levelledCookie('opp-ally', 1, 'red'), ['opp-hp'])

    const [effect] = effectsOf('BS3-061')
    if (effect.kind !== 'damage-all') throw new Error('unexpected effect')

    const ctx: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }
    const next = executeCardEffect(state, ctx, effect, [])
    const oppCookies = next.players['player-one'].battleArea
    expect(oppCookies.every((c) => c.hpCards.length === 2)).toBe(true)
  })
})

describe('BS3-062 Carol Cookie: on-play modify-attack with green filter', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-062'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: {
        side: 'self',
        min: 0,
        max: 1,
        excludeSource: true,
        energyColor: 'green',
      },
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })

  it('only targets green allies', () => {
    let state = createBattleState()
    state = withSupport(state, 'player-two', Array.from({ length: 6 }, (_, i) => ({ id: `sup-${i}` })))
    state = withAlly(state, levelledCookie('green-ally', 1, 'green'), ['g-hp'])
    state = withAlly(state, levelledCookie('red-ally', 1, 'red'), ['r-hp'])

    const [effect] = effectsOf('BS3-062')
    if (effect.kind !== 'modify-attack') throw new Error('unexpected effect')

    const ctx = sourceContext()
    const candidates = getEffectTargetCandidates(state, ctx, effect.target)
    expect(candidates.map((c) => c.card.instanceId)).toEqual(['green-ally'])
  })
})

describe('BS3-063 Carameleon Cookie: on-play support-to-hand + hand-to-support', () => {
  it('converts correctly', () => {
    expect(effectsOf('BS3-063')).toEqual([
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'hand-to-support', amount: 1, rested: true },
    ])
  })
})

describe('BS3-064 Clover Cookie: faint support-to-hand + draw', () => {
  it('converts correctly', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-064'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('passive')
    expect(skill!.effects).toEqual([
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'draw-up-to', max: 1 },
    ])
  })
})

describe('BS3-065 Herb Cookie: on-play hand-to-support + conditional draw', () => {
  it('converts correctly', () => {
    expect(effectsOf('BS3-065')).toEqual([
      { kind: 'hand-to-support', amount: 1, rested: true },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'support-count-at-least', count: 8 },
      },
    ])
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-065'))
    expect(skill?.trigger).toBe('on-play')
  })
})

describe('BS3-066 Soul Jam: Light of Freedom', () => {
  it('converts to support-to-hand + deck-to-support + equip-source', () => {
    const conversion = convertOfficialItemAbility(findBs3Card('BS3-066'))
    expect(conversion).toBeTruthy()
    expect(conversion!.effects).toEqual([
      { kind: 'support-to-hand', amount: 1 },
      { kind: 'deck-to-support', amount: 1, rested: false },
      {
        kind: 'equip-source',
        target: { side: 'self', min: 0, max: 1 },
        requiredCookieId: 'BS3-055',
      },
    ])
  })
})

describe('BS3-067 Faerie Kingdom Music: item draw + set-active', () => {
  it('converts correctly', () => {
    const conversion = convertOfficialItemAbility(findBs3Card('BS3-067'))
    expect(conversion).toBeTruthy()
    expect(conversion!.effects).toEqual([
      { kind: 'draw-up-to', max: 2 },
      { kind: 'set-active', supportCount: 1, selectable: true },
    ])
  })
})

describe('BS3-068 Elder Faerie Sword: choose-one item', () => {
  it('converts to choose-one with two modes', () => {
    const conversion = convertOfficialItemAbility(findBs3Card('BS3-068'))
    expect(conversion).toBeTruthy()
    const chooseOne = conversion!.effects.find((e) => e.kind === 'choose-one')
    expect(chooseOne).toBeDefined()
    if (!chooseOne || chooseOne.kind !== 'choose-one') throw new Error('expected choose-one')
    expect(chooseOne.modes).toHaveLength(2)
  })
})

describe('BS3-069 The New Guardian Power: trap', () => {
  it('converts correctly', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-069'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toEqual([
      {
        kind: 'modify-attack',
        amount: -2,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      { kind: 'support-to-trash', amount: 2 },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ])
  })
})

describe('BS3-070 Puppet Theater of Chaos: trap', () => {
  it('converts correctly', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-070'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toEqual([
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
      },
      {
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'support-count-at-least', count: 5 },
      },
      {
        kind: 'discard-hand',
        count: 1,
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ])
  })
})

describe('BS3-071 Ancient Silver Tree: stage disable-flip', () => {
  it('converts correctly', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-071'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toEqual([
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
      },
    ])
  })

  it('disable-flip stores flip-disabled state on game state', () => {
    let state = createBattleState()
    state = withOpponentAlly(state, levelledCookie('opp-flip', 1, 'red'), ['flip-hp'])

    const stage = convertOfficialStageAbility(findBs3Card('BS3-071'))
    const effect = stage!.effects[0]
    if (effect.kind !== 'disable-flip') throw new Error('unexpected effect')

    const ctx: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }
    const next = executeCardEffect(state, ctx, effect, ['opp-flip'])
    expect(next.flipDisabledUntilTurn).toBeDefined()
    expect(next.flipDisabledUntilTurn!['opp-flip']).toBe(state.turnNumber)
  })
})

describe('BS3-072 Mystical Faerie Kingdom: stage rest-support', () => {
  it('converts correctly via stage ability', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-072'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toEqual([
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
      },
    ])
  })

  it('rest-support rests an active opponent support card', () => {
    let state = createBattleState()
    state = withSupport(state, 'player-one', [{ id: 'opp-sup', rested: false }])

    const stage = convertOfficialStageAbility(findBs3Card('BS3-072'))
    const effect = stage!.effects[0]
    if (effect.kind !== 'rest-support') throw new Error('unexpected effect')

    const ctx: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }
    const next = executeCardEffect(state, ctx, effect, ['opp-sup'])
    const oppSupport = next.players['player-one'].supportArea.find(
      (s) => s.card.instanceId === 'opp-sup',
    )
    expect(oppSupport?.rested).toBe(true)
  })
})
