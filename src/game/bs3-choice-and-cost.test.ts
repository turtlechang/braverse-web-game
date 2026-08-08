import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { executeCardEffect, expandChooseOne, expandChooseOneSequence } from './effects'
import { activateCookieSkill, canActivateCookieSkill } from './skills'
import { createSeededShuffle } from './helpers'
import { chooseAiEffectMode } from './ai/choose-one-mode'
import type {
  CardEffect,
  CookieCard,
  EffectContext,
  GameCard,
  GameState,
} from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

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

const purpleCookie = (instanceId: string): CookieCard => ({
  ...cookie(instanceId),
  energyColor: 'purple',
})

const sourceContext = (): EffectContext => ({
  sourcePlayerId: 'player-two',
  sourceInstanceId: 'attacker',
  sourceCardName: 'source',
})

const withTrash = (state: GameState, cards: GameCard[]): GameState => ({
  ...state,
  players: {
    ...state.players,
    'player-two': { ...state.players['player-two'], discardPile: cards },
  },
})

describe('BS3-068 Elder Faerie’s Sword: choose-one', () => {
  const chooseOne = () => {
    const [effect] = effectsOf('BS3-068')
    if (effect.kind !== 'choose-one') throw new Error('unexpected effect')
    return effect
  }

  it('converts the item text into two selectable modes', () => {
    const effect = chooseOne()
    expect(effect.modes).toHaveLength(2)
    expect(effect.modes[0].effects).toEqual([
      { kind: 'place-source-to-support', rested: true },
    ])
    expect(effect.modes[1].effects).toEqual([
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      { kind: 'support-to-trash', amount: 2 },
    ])
  })

  it('expands in place so the queue continues at the chosen mode', () => {
    const queue: CardEffect[] = [chooseOne(), { kind: 'draw', amount: 1 }]

    expect(expandChooseOne(queue, 0, 1)).toEqual([
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      { kind: 'support-to-trash', amount: 2 },
      { kind: 'draw', amount: 1 },
    ])
    expect(expandChooseOneSequence(queue, [0])).toEqual([
      { kind: 'place-source-to-support', rested: true },
      { kind: 'draw', amount: 1 },
    ])
  })

  it('rejects an out-of-range mode', () => {
    expect(() => expandChooseOne([chooseOne()], 0, 2)).toThrowError()
  })

  it('never executes the choose-one itself', () => {
    expect(() =>
      executeCardEffect(createBattleState(), sourceContext(), chooseOne(), []),
    ).toThrowError('選擇一項')
  })

  it('AI prefers the aggressive mode only when the support cost is payable', () => {
    // createBattleState 給 player-two 只有 1 張支援卡，付不出 2 張代價。
    const lowSupport = createBattleState()
    expect(chooseAiEffectMode(lowSupport, sourceContext(), chooseOne())).toBe(0)

    const richSupport: GameState = {
      ...lowSupport,
      players: {
        ...lowSupport.players,
        'player-two': {
          ...lowSupport.players['player-two'],
          supportArea: [
            { card: item('s1'), rested: false },
            { card: item('s2'), rested: false },
            { card: item('s3'), rested: false },
          ],
        },
      },
    }
    expect(chooseAiEffectMode(richSupport, sourceContext(), chooseOne())).toBe(1)
  })
})

describe('BS3-112 Prune Juice Cookie: trash-to-deck-bottom cost', () => {
  const skill = () => {
    const converted = convertOfficialCookieSkill(findBs3Card('BS3-112'))
    if (!converted) throw new Error('BS3-112 skill should convert.')
    return converted
  }

  it('converts the bracket text into a trash cost and a filtered return', () => {
    expect(skill().cost.trashToDeckBottom).toEqual({
      count: 2,
      nonCookieOnly: true,
    })
    expect(effectsOf('BS3-112')).toEqual([
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple', cookieOnly: true },
    ])
  })

  it('returns only purple Cookies from the trash', () => {
    const state = withTrash(createBattleState(), [
      purpleCookie('purple-cookie'),
      item('purple-item', 'purple'),
      cookie('red-cookie'),
    ])

    const next = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-112')[0],
      ['purple-cookie'],
    )
    expect(next.players['player-two'].hand.map((card) => card.instanceId)).toContain(
      'purple-cookie',
    )

    expect(() =>
      executeCardEffect(state, sourceContext(), effectsOf('BS3-112')[0], [
        'purple-item',
      ]),
    ).toThrowError()
  })

  // {ap} 技能只有在對應的 pendingOnPlay 存在時才可發動。
  const withSkillSource = (state: GameState): GameState => ({
    ...state,
    pendingOnPlay: { playerId: 'player-two', sourceInstanceId: 'attacker' },
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        battleArea: state.players['player-two'].battleArea.map((entry) =>
          entry.card.instanceId === 'attacker'
            ? { ...entry, card: { ...entry.card, skill: skill() } }
            : entry,
        ),
        supportArea: [
          { card: item('purple-support', 'purple'), rested: false },
        ],
      },
    },
  })

  it('blocks activation until two non-Cookie cards sit in the trash', () => {
    const notEnough = withSkillSource(
      withTrash(createBattleState(), [
        item('trash-item-a'),
        purpleCookie('trash-cookie'),
      ]),
    )
    expect(
      canActivateCookieSkill(notEnough, 'player-two', 'attacker', 'on-play'),
    ).toBe(false)

    const enough = withSkillSource(
      withTrash(createBattleState(), [
        item('trash-item-a'),
        item('trash-item-b'),
        purpleCookie('trash-cookie'),
      ]),
    )
    expect(
      canActivateCookieSkill(enough, 'player-two', 'attacker', 'on-play'),
    ).toBe(true)
  })

  it('moves the paid cards to the deck bottom in the selected order', () => {
    const state = withSkillSource(
      withTrash(createBattleState(), [
        item('trash-item-a'),
        item('trash-item-b'),
        purpleCookie('trash-cookie'),
      ]),
    )

    const activated = activateCookieSkill(
      state,
      'player-two',
      'attacker',
      'on-play',
      ['purple-support'],
      [],
      [],
      [],
      ['trash-item-b', 'trash-item-a'],
    )

    const player = activated.players['player-two']
    expect(player.deck.map((card) => card.instanceId)).toEqual([
      'p2-deck-a',
      'trash-item-b',
      'trash-item-a',
    ])
    expect(player.discardPile.map((card) => card.instanceId)).toEqual([
      'trash-cookie',
    ])
  })

  it('rejects paying with a Cookie from the trash', () => {
    const state = withSkillSource(
      withTrash(createBattleState(), [
        item('trash-item-a'),
        item('trash-item-b'),
        purpleCookie('trash-cookie'),
      ]),
    )

    expect(() =>
      activateCookieSkill(
        state,
        'player-two',
        'attacker',
        'on-play',
        ['purple-support'],
        [],
        [],
        [],
        ['trash-item-a', 'trash-cookie'],
      ),
    ).toThrowError()
  })

  it('rejects paying the wrong number of cards', () => {
    const state = withSkillSource(
      withTrash(createBattleState(), [
        item('trash-item-a'),
        item('trash-item-b'),
      ]),
    )

    expect(() =>
      activateCookieSkill(
        state,
        'player-two',
        'attacker',
        'on-play',
        ['purple-support'],
        [],
        [],
        [],
        ['trash-item-a'],
      ),
    ).toThrowError()
  })
})

describe('BS3-098 Kumiho Cookie: trash-to-deck cost', () => {
  const skill = () => {
    const converted = convertOfficialCookieSkill(findBs3Card('BS3-098'))
    if (!converted) throw new Error('BS3-098 skill should convert.')
    return converted
  }

  const withKumihoSource = (state: GameState): GameState => ({
    ...state,
    pendingOnPlay: { playerId: 'player-two', sourceInstanceId: 'attacker' },
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        battleArea: state.players['player-two'].battleArea.map((entry) =>
          entry.card.instanceId === 'attacker'
            ? { ...entry, card: { ...entry.card, skill: skill() } }
            : entry,
        ),
        supportArea: [
          { card: item('purple-support', 'purple'), rested: false },
        ],
      },
    },
  })

  const eligibleTrash = () =>
    Array.from({ length: 5 }, (_, index) =>
      item(`kumiho-trash-${index}`, 'purple'),
    )

  it('converts the five purple non-FLIP cards requirement', () => {
    expect(skill().cost.trashToDeck).toEqual({
      count: 5,
      energyColor: 'purple',
      excludeFlip: true,
    })
  })

  it('requires five eligible cards and shuffles them into the deck', () => {
    const flipCard = {
      ...item('kumiho-flip-trash', 'purple'),
      flip: { text: 'FLIP', cost: { energy: {} }, effects: [] },
    }
    const state = withKumihoSource(
      withTrash(createBattleState(), [...eligibleTrash(), flipCard]),
    )

    expect(
      canActivateCookieSkill(state, 'player-two', 'attacker', 'on-play'),
    ).toBe(true)

    const selectedIds = eligibleTrash().map((card) => card.instanceId)
    const activated = activateCookieSkill(
      state,
      'player-two',
      'attacker',
      'on-play',
      ['purple-support'],
      [],
      [],
      [],
      [],
      selectedIds,
      createSeededShuffle(98),
    )

    const player = activated.players['player-two']
    expect(player.deck).toHaveLength(6)
    expect(player.deck.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining(selectedIds),
    )
    expect(player.discardPile.map((card) => card.instanceId)).toEqual([
      'kumiho-flip-trash',
    ])
  })

  it('rejects a non-purple or FLIP card as the cost', () => {
    const nonPurple = item('kumiho-red-trash', 'red')
    const state = withKumihoSource(
      withTrash(createBattleState(), [...eligibleTrash().slice(0, 4), nonPurple]),
    )

    expect(() =>
      activateCookieSkill(
        state,
        'player-two',
        'attacker',
        'on-play',
        ['purple-support'],
        [],
        [],
        [],
        [],
        [...eligibleTrash().slice(0, 4).map((card) => card.instanceId), 'kumiho-red-trash'],
      ),
    ).toThrowError()
  })
})

describe('resolve-choose-one command', () => {
  it('rewrites the pending ability queue without executing anything', () => {
    const [effect] = effectsOf('BS3-068')
    const state: GameState = {
      ...createBattleState(),
      pendingAbilityEffect: {
        playerId: 'player-two',
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceKind: 'item',
        effects: [effect],
        effectIndex: 0,
      },
    }

    const next = applyGameCommand(state, {
      kind: 'resolve-choose-one',
      playerId: 'player-two',
      modeIndex: 1,
    })

    expect(next.pendingAbilityEffect?.effectIndex).toBe(0)
    expect(next.pendingAbilityEffect?.effects).toEqual([
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      { kind: 'support-to-trash', amount: 2 },
    ])
    // 只改寫佇列，盤面不動。
    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
  })

  it('refuses a player who is not resolving the ability', () => {
    const [effect] = effectsOf('BS3-068')
    const state: GameState = {
      ...createBattleState(),
      pendingAbilityEffect: {
        playerId: 'player-two',
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceKind: 'item',
        effects: [effect],
        effectIndex: 0,
      },
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-choose-one',
        playerId: 'player-one',
        modeIndex: 0,
      }),
    ).toThrowError()
  })

  it('clears the pending queue when the final mode intentionally has no effects', () => {
    const state: GameState = {
      ...createBattleState(),
      pendingAbilityEffect: {
        playerId: 'player-two',
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceKind: 'item',
        effects: [
          {
            kind: 'choose-one',
            modes: [
              {
                label: '執行效果',
                effects: [{ kind: 'deck-to-trash', amount: 1, side: 'self' }],
              },
              { label: '不執行', effects: [] },
            ],
          },
        ],
        effectIndex: 0,
      },
    }

    const next = applyGameCommand(state, {
      kind: 'resolve-choose-one',
      playerId: 'player-two',
      modeIndex: 1,
    })

    expect(next.pendingAbilityEffect).toBeUndefined()
  })
})
