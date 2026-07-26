import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/candidates/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  executeCardEffect,
  getEffectTargetCandidates,
  getTargetPlayerId,
  isEffectConditionMet,
  resolveInspectDeck,
  resolveOpponentHandDiscard,
} from './effects'
import type {
  CardEffect,
  CookieCard,
  EffectContext,
  GameCard,
  GameState,
  PlayerId,
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

const levelledCookie = (
  instanceId: string,
  level: number,
  energyColor: CookieCard['energyColor'] = 'red',
): CookieCard => ({ ...cookie(instanceId), level, energyColor })

/** player-two 是 createBattleState 的主動方，`attacker` 是效果來源。 */
const sourceContext = (): EffectContext => ({
  sourcePlayerId: 'player-two',
  sourceInstanceId: 'attacker',
  sourceCardName: 'source',
})

const withDeck = (
  state: GameState,
  playerId: PlayerId,
  cards: GameCard[],
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: { ...state.players[playerId], deck: cards },
  },
})

const withHand = (
  state: GameState,
  playerId: PlayerId,
  cards: GameCard[],
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: { ...state.players[playerId], hand: cards },
  },
})

const withExtraCookie = (
  state: GameState,
  playerId: PlayerId,
  card: CookieCard,
  hpCardIds: string[],
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: {
      ...state.players[playerId],
      battleArea: [
        ...state.players[playerId].battleArea,
        {
          card,
          hpCards: hpCardIds.map((id) => item(id)),
          rested: false,
          battleEntryId: `${card.instanceId}:battle:9`,
        },
      ],
    },
  },
})

describe('either-side battle targeting', () => {
  it('refuses to collapse an either selector into a single owner', () => {
    expect(() =>
      getTargetPlayerId(sourceContext(), { side: 'either', min: 0, max: 1 }),
    ).toThrowError('either')
  })

  it('BS3-040 offers LV.1 Cookies from both battle areas', () => {
    let state = withExtraCookie(
      createBattleState(),
      'player-two',
      levelledCookie('ally-lv1', 1),
      ['ally-hp'],
    )
    state = withExtraCookie(state, 'player-one', levelledCookie('foe-lv1', 1), [
      'foe-hp',
    ])
    state = withExtraCookie(state, 'player-one', levelledCookie('foe-lv2', 2), [
      'foe-hp-2',
    ])

    expect(effectsOf('BS3-040')).toEqual([
      {
        kind: 'battle-to-break',
        target: { side: 'either', min: 0, max: 1, maxLevel: 1 },
      },
    ])

    const [effect] = effectsOf('BS3-040')
    if (effect.kind !== 'battle-to-break') throw new Error('unexpected effect')
    // 來源方先列出，接著才是對手方；LV.2 的對手餅乾被 maxLevel 濾掉。
    expect(
      getEffectTargetCandidates(state, sourceContext(), effect.target).map(
        (entry) => entry.card.instanceId,
      ),
    ).toEqual(['attacker', 'ally-lv1', 'defender', 'foe-lv1'])
  })

  it('BS3-040 sends the chosen opposing Cookie to its own owner break area', () => {
    const state = withExtraCookie(
      createBattleState(),
      'player-one',
      levelledCookie('foe-lv1', 1),
      ['foe-hp'],
    )

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-040')[0], [
      'foe-lv1',
    ])

    expect(
      next.players['player-one'].breakArea.map((card) => card.instanceId),
    ).toEqual(['foe-lv1'])
    expect(next.players['player-two'].breakArea).toHaveLength(0)
    expect(
      next.players['player-one'].discardPile.map((card) => card.instanceId),
    ).toEqual(['foe-hp'])
  })

  it('BS3-076 puts the chosen Cookie on top of its own owner deck', () => {
    let state = withExtraCookie(
      createBattleState(),
      'player-one',
      levelledCookie('foe-lv2', 2),
      ['foe-hp'],
    )
    state = withDeck(state, 'player-one', [item('p1-deck-a')])

    expect(effectsOf('BS3-076')).toEqual([
      {
        kind: 'battle-to-deck-top',
        target: { side: 'either', min: 0, max: 1, maxLevel: 2 },
      },
    ])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-076')[0], [
      'foe-lv2',
    ])

    expect(
      next.players['player-one'].deck.map((card) => card.instanceId),
    ).toEqual(['foe-lv2', 'p1-deck-a'])
    expect(
      next.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['p2-deck-a'])
  })
})

describe('BS3-028 Mozzarella Cookie: opponent trash to opponent break area', () => {
  const withOpponentTrash = (state: GameState, cards: GameCard[]): GameState => ({
    ...state,
    players: {
      ...state.players,
      'player-one': { ...state.players['player-one'], discardPile: cards },
    },
  })

  it('converts the skill with the opponent break-level ceiling', () => {
    expect(effectsOf('BS3-028')).toEqual([
      {
        kind: 'opponent-trash-to-break',
        max: 1,
        exactLevel: 1,
        condition: { kind: 'opponent-break-level-at-most', level: 6 },
      },
    ])
  })

  it('moves the selected LV.1 Cookie into the opponent break area', () => {
    const state = withOpponentTrash(createBattleState(), [
      levelledCookie('foe-trash-lv1', 1),
      levelledCookie('foe-trash-lv2', 2),
    ])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-028')[0], [
      'foe-trash-lv1',
    ])

    expect(
      next.players['player-one'].breakArea.map((card) => card.instanceId),
    ).toEqual(['foe-trash-lv1'])
    expect(
      next.players['player-one'].discardPile.map((card) => card.instanceId),
    ).toEqual(['foe-trash-lv2'])
  })

  it('rejects a Cookie outside the exact level filter', () => {
    const state = withOpponentTrash(createBattleState(), [
      levelledCookie('foe-trash-lv2', 2),
    ])

    expect(() =>
      executeCardEffect(state, sourceContext(), effectsOf('BS3-028')[0], [
        'foe-trash-lv2',
      ]),
    ).toThrowError()
  })

  it('is skipped once the opponent break area passes LV.6', () => {
    let state = withOpponentTrash(createBattleState(), [
      levelledCookie('foe-trash-lv1', 1),
    ])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: Array.from({ length: 7 }, (_, index) =>
            levelledCookie(`foe-break-${index}`, 1),
          ),
        },
      },
    }

    expect(
      isEffectConditionMet(state, sourceContext(), effectsOf('BS3-028')[0]),
    ).toBe(false)
  })
})

describe('BS3-029 Burnt Cheese Cookie: hand-to-battle on faint', () => {
  it('converts the faint skill into an optional yellow play with +1 HP', () => {
    expect(effectsOf('BS3-029')).toEqual([
      {
        kind: 'hand-to-battle',
        amount: 1,
        energyColor: 'yellow',
        optional: true,
        gainHp: 1,
      },
    ])
    expect(convertOfficialCookieSkill(findBs3Card('BS3-029'))?.faint).toBe(true)
  })

  it('plays the chosen yellow Cookie with one extra HP card', () => {
    let state = withDeck(createBattleState(), 'player-two', [
      item('hp-1'),
      item('hp-2'),
      item('hp-3'),
      item('hp-4'),
    ])
    state = withHand(state, 'player-two', [
      levelledCookie('yellow-hand', 1, 'yellow'),
      levelledCookie('blue-hand', 1, 'blue'),
    ])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-029')[0], [
      'yellow-hand',
    ])

    const played = next.players['player-two'].battleArea.find(
      (entry) => entry.card.instanceId === 'yellow-hand',
    )
    // 測試用 cookie() 的基礎 HP 是 2，加上 gainHp 1 共 3 張。
    expect(played?.hpCards).toHaveLength(3)
    expect(
      next.players['player-two'].hand.map((card) => card.instanceId),
    ).toEqual(['blue-hand'])
  })

  it('rejects a hand Cookie of the wrong colour', () => {
    const state = withHand(createBattleState(), 'player-two', [
      levelledCookie('blue-hand', 1, 'blue'),
    ])

    expect(() =>
      executeCardEffect(state, sourceContext(), effectsOf('BS3-029')[0], [
        'blue-hand',
      ]),
    ).toThrowError()
  })
})

describe('BS3-073 Candy Diver Cookie: reveal-bottom-deck', () => {
  it('converts the skill into a bottom-of-deck reveal', () => {
    expect(effectsOf('BS3-073')).toEqual([
      {
        kind: 'reveal-bottom-deck',
        cookieDestination: 'deck-top',
        otherwiseDestination: 'hand',
      },
    ])
  })

  it('moves a revealed Cookie to the top of the deck', () => {
    const state = withDeck(createBattleState(), 'player-two', [
      item('deck-a'),
      levelledCookie('deck-bottom-cookie', 1),
    ])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-073')[0], [])

    expect(
      next.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['deck-bottom-cookie', 'deck-a'])
    expect(next.players['player-two'].hand).toHaveLength(1)
  })

  it('adds a revealed non-Cookie card to the hand', () => {
    const state = withDeck(createBattleState(), 'player-two', [
      item('deck-a'),
      item('deck-bottom-item'),
    ])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-073')[0], [])

    expect(
      next.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['deck-a'])
    expect(
      next.players['player-two'].hand.map((card) => card.instanceId),
    ).toContain('deck-bottom-item')
  })

  it('does nothing with an empty deck', () => {
    const state = withDeck(createBattleState(), 'player-two', [])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-073')[0], [])

    expect(next.players['player-two'].deck).toHaveLength(0)
    expect(next.players['player-two'].hand).toHaveLength(1)
  })
})

describe('BS3-083 Captain Caviar Cookie: reorder the top of the deck', () => {
  it('converts the skill into a pick-nothing inspect that returns to the top', () => {
    expect(effectsOf('BS3-083')).toEqual([
      { kind: 'inspect-deck', lookCount: 3, pickCount: 0, restDestination: 'top' },
    ])
  })

  it('puts the viewed cards back on top in the chosen order', () => {
    const state = withDeck(createBattleState(), 'player-two', [
      item('top-a'),
      item('top-b'),
      item('top-c'),
      item('rest-d'),
    ])

    const revealed = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-083')[0],
      [],
    )
    expect(revealed.pendingInspectDeck?.restDestination).toBe('top')
    expect(
      revealed.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['rest-d'])

    const resolved = resolveInspectDeck(revealed, 'player-two', null, [
      'top-c',
      'top-a',
      'top-b',
    ])

    expect(
      resolved.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['top-c', 'top-a', 'top-b', 'rest-d'])
  })
})

describe('BS3-088 Pure Vanilla Cookie: draw then place a hand card on top', () => {
  it('converts the skill into a draw-up-to whose follow-up targets the deck top', () => {
    expect(effectsOf('BS3-088')).toEqual([
      {
        kind: 'draw-up-to-then-discard',
        max: 3,
        discardCount: 1,
        handDestination: 'deck-top',
      },
    ])
  })

  it('carries the deck-top destination into the pending hand decision', () => {
    const next = executeCardEffect(
      createBattleState(),
      sourceContext(),
      effectsOf('BS3-088')[0],
      [],
    )

    expect(next.pendingDrawUpTo?.afterEffects).toEqual([
      { kind: 'discard-hand', count: 1, destination: 'deck-top' },
    ])
  })

  it('places the selected hand card on top of the deck instead of the trash', () => {
    const base = withHand(
      withDeck(createBattleState(), 'player-two', [item('deck-a')]),
      'player-two',
      [item('hand-a'), item('hand-b')],
    )
    const state: GameState = {
      ...base,
      pendingOpponentHandDiscard: {
        playerId: 'player-two',
        count: 1,
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'attacker',
        sourceCardName: 'Pure Vanilla Cookie',
        effectText: 'discard-hand',
        destination: 'deck-top',
      },
    }

    const next = resolveOpponentHandDiscard(state, 'player-two', ['hand-b'])

    expect(
      next.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['hand-b', 'deck-a'])
    expect(next.players['player-two'].discardPile).toHaveLength(0)
    expect(
      next.players['player-two'].hand.map((card) => card.instanceId),
    ).toEqual(['hand-a'])
  })
})

describe('BS3-114 Bittersweet Incense: view five, play one, trash the rest', () => {
  it('converts the item into a filtered inspect that plays into the battle area', () => {
    expect(effectsOf('BS3-114')).toEqual([
      {
        kind: 'inspect-deck',
        lookCount: 5,
        pickCount: 1,
        restDestination: 'trash',
        pickDestination: 'battle',
        filterColor: 'purple',
        filterType: 'cookie',
        optionalPick: true,
      },
    ])
  })

  it('plays the chosen purple Cookie and trashes the remaining views', () => {
    const state = withDeck(createBattleState(), 'player-two', [
      levelledCookie('purple-cookie', 1, 'purple'),
      item('view-b'),
      item('view-c'),
      item('view-d'),
      item('view-e'),
      item('hp-a'),
      item('hp-b'),
      item('left-over'),
    ])

    const revealed = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-114')[0],
      [],
    )
    const resolved = resolveInspectDeck(revealed, 'player-two', 'purple-cookie', [
      'view-b',
      'view-c',
      'view-d',
      'view-e',
    ])

    const played = resolved.players['player-two'].battleArea.find(
      (entry) => entry.card.instanceId === 'purple-cookie',
    )
    expect(played?.hpCards.map((card) => card.instanceId)).toEqual([
      'hp-a',
      'hp-b',
    ])
    expect(
      resolved.players['player-two'].discardPile.map((card) => card.instanceId),
    ).toEqual(['view-b', 'view-c', 'view-d', 'view-e'])
    expect(
      resolved.players['player-two'].deck.map((card) => card.instanceId),
    ).toEqual(['left-over'])
  })

  it('trashes every viewed card when no purple Cookie is picked', () => {
    const state = withDeck(createBattleState(), 'player-two', [
      item('view-a'),
      item('view-b'),
      item('view-c'),
      item('view-d'),
      item('view-e'),
      item('left-over'),
    ])

    const revealed = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-114')[0],
      [],
    )
    const resolved = resolveInspectDeck(revealed, 'player-two', null, [
      'view-a',
      'view-b',
      'view-c',
      'view-d',
      'view-e',
    ])

    expect(resolved.players['player-two'].battleArea).toHaveLength(1)
    expect(resolved.players['player-two'].discardPile).toHaveLength(5)
  })

  it('rejects picking a card that fails the colour filter', () => {
    const state = withDeck(createBattleState(), 'player-two', [
      levelledCookie('blue-cookie', 1, 'blue'),
      item('view-b'),
      item('view-c'),
      item('view-d'),
      item('view-e'),
    ])

    const revealed = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-114')[0],
      [],
    )

    expect(() =>
      resolveInspectDeck(revealed, 'player-two', 'blue-cookie', [
        'view-b',
        'view-c',
        'view-d',
        'view-e',
      ]),
    ).toThrowError()
  })
})
