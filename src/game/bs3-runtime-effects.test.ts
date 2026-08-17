import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  executeCardEffect,
  getEffectTargetCandidates,
  resolveDrawUpTo,
} from './effects'
import { resolveNextDamage } from './battle'
import type { CardEffect, CookieCard, EffectContext, GameState } from './types'
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
): CookieCard => ({
  ...cookie(instanceId),
  level,
  energyColor,
})

/** player-two 是 createBattleState 的主動方，`attacker` 是效果來源。 */
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

describe('BS3-031 Pancake Cookie: transfer-hp to-source', () => {
  it('converts the skill into a to-source HP transfer that excludes itself', () => {
    expect(effectsOf('BS3-031')).toEqual([
      {
        kind: 'transfer-hp',
        amount: 1,
        direction: 'to-source',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ])
  })

  it('moves the top HP card from the selected ally onto the source', () => {
    const state = withAlly(createBattleState(), levelledCookie('ally', 1), [
      'ally-hp-a',
      'ally-hp-b',
    ])

    const next = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-031')[0],
      ['ally'],
    )

    const battleArea = next.players['player-two'].battleArea
    expect(battleArea[0].hpCards.map((card) => card.instanceId)).toEqual([
      'attacker-hp',
      'ally-hp-b',
    ])
    expect(battleArea[1].hpCards.map((card) => card.instanceId)).toEqual([
      'ally-hp-a',
    ])
  })

  it('faints the ally that gave away its last HP card but still moves it', () => {
    const state = withAlly(createBattleState(), levelledCookie('ally', 1), [
      'ally-hp-a',
    ])

    const next = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-031')[0],
      ['ally'],
    )

    const player = next.players['player-two']
    expect(player.battleArea).toHaveLength(1)
    expect(player.battleArea[0].hpCards.map((card) => card.instanceId)).toEqual([
      'attacker-hp',
      'ally-hp-a',
    ])
    expect(player.breakArea.map((card) => card.instanceId)).toEqual(['ally'])
  })

  it('is a no-op when no ally is selected', () => {
    const state = withAlly(createBattleState(), levelledCookie('ally', 1), [
      'ally-hp-a',
    ])

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-031')[0], [])

    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(next.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
  })
})

describe('BS3-089 Financier Cookie: damage then transfer-hp from-source', () => {
  it('converts the skill into opponent damage followed by a from-source transfer', () => {
    expect(effectsOf('BS3-089')).toEqual([
      { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
      {
        kind: 'transfer-hp',
        amount: 1,
        direction: 'from-source',
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
    ])
  })

  it('moves the source top HP card onto the selected ally', () => {
    let state = withAlly(createBattleState(), levelledCookie('ally', 1), ['ally-hp-a'])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: state.players['player-two'].battleArea.map((entry) =>
            entry.card.instanceId === 'attacker'
              ? { ...entry, hpCards: [item('attacker-hp'), item('attacker-hp-2')] }
              : entry,
          ),
        },
      },
    }

    const next = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-089')[1],
      ['ally'],
    )

    const battleArea = next.players['player-two'].battleArea
    expect(battleArea[0].hpCards.map((card) => card.instanceId)).toEqual([
      'attacker-hp',
    ])
    expect(battleArea[1].hpCards.map((card) => card.instanceId)).toEqual([
      'ally-hp-a',
      'attacker-hp-2',
    ])
  })

  it('faints the source when it hands over its last HP card', () => {
    const state = withAlly(createBattleState(), levelledCookie('ally', 1), ['ally-hp-a'])

    const next = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-089')[1],
      ['ally'],
    )

    const player = next.players['player-two']
    expect(player.battleArea.map((entry) => entry.card.instanceId)).toEqual(['ally'])
    expect(player.battleArea[0].hpCards.map((card) => card.instanceId)).toEqual([
      'ally-hp-a',
      'attacker-hp',
    ])
    expect(player.breakArea.map((card) => card.instanceId)).toEqual(['attacker'])
  })
})

describe('BS3-053 Butter Roll Cookie: set-cookie-active', () => {
  it('converts the skill into a green rested-only activation with a support cost', () => {
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
    state = withAlly(state, levelledCookie('active-green', 1, 'green'), [
      'active-green-hp',
    ])
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

describe('BS3-092 Old Vanilla Orchid Locket: draw-up-to-battle-cookie-count', () => {
  it('converts the item text into a per-LV.2-Cookie draw', () => {
    expect(effectsOf('BS3-092')).toEqual([
      { kind: 'draw-up-to-battle-cookie-count', level: 2, amountPerCookie: 1 },
    ])
  })

  it('counts LV.2 Cookies in both battle areas', () => {
    let state = withAlly(createBattleState(), levelledCookie('ally-lv2', 2), ['ally-hp'])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            ...state.players['player-one'].battleArea,
            {
              card: levelledCookie('foe-lv2', 2),
              hpCards: [item('foe-hp')],
              rested: false,
              battleEntryId: 'foe-lv2:battle:8',
            },
          ],
        },
      },
    }

    const next = executeCardEffect(state, sourceContext(), effectsOf('BS3-092')[0], [])

    expect(next.pendingDrawUpTo?.max).toBe(2)
    expect(next.pendingDrawUpTo?.playerId).toBe('player-two')
  })

  it('does nothing when no LV.2 Cookie is on the field', () => {
    const next = executeCardEffect(
      createBattleState(),
      sourceContext(),
      effectsOf('BS3-092')[0],
      [],
    )

    expect(next.pendingDrawUpTo).toBeUndefined()
  })

  /**
   * 官方 Q&A：雙方戰鬥區共 3 個 LV.2 時上限為 3，可選抽 3／2／1／0。
   * 己方 LV.2-a + 對手 LV.2-a + 對手 LV.2-b = 3
   */
  it('lets the player draw any amount up to the combined LV.2 count', () => {
    let state = withAlly(createBattleState(), levelledCookie('ally-lv2-a', 2), [
      'ally-a-hp',
    ])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              card: levelledCookie('foe-lv2-a', 2),
              hpCards: [item('foe-a-hp')],
              rested: false,
              battleEntryId: 'foe-lv2-a:battle:8',
            },
            {
              card: levelledCookie('foe-lv2-b', 2),
              hpCards: [item('foe-b-hp')],
              rested: false,
              battleEntryId: 'foe-lv2-b:battle:9',
            },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          deck: [item('d1'), item('d2'), item('d3'), item('d4')],
        },
      },
    }

    const pending = executeCardEffect(
      state,
      sourceContext(),
      effectsOf('BS3-092')[0],
      [],
    )
    expect(pending.pendingDrawUpTo?.max).toBe(3)

    const drawTwo = resolveDrawUpTo(pending, 'player-two', 2)
    expect(drawTwo.players['player-two'].hand.length).toBe(
      state.players['player-two'].hand.length + 2,
    )
    expect(drawTwo.pendingDrawUpTo).toBeNull()

    const drawZero = resolveDrawUpTo(pending, 'player-two', 0)
    expect(drawZero.players['player-two'].hand.length).toBe(
      state.players['player-two'].hand.length,
    )
  })
})

describe('BS3-113 Caramel Arrow Cookie: trash-to-deck-all', () => {
  const withPurpleTrash = (state: GameState, count: number): GameState => ({
    ...state,
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        discardPile: Array.from({ length: count }, (_, index) =>
          item(`purple-trash-${index}`, 'purple'),
        ),
      },
    },
  })

  it('nests the damage so it survives the trash being emptied', () => {
    expect(effectsOf('BS3-113')).toEqual([
      {
        kind: 'trash-to-deck-all',
        condition: {
          kind: 'trash-color-count-at-least',
          color: 'purple',
          count: 15,
        },
        thenEffects: [
          {
            kind: 'damage-all',
            amount: 2,
            side: 'opponent',
            sequential: true,
            target: { side: 'opponent', min: 1, max: 2 },
          },
        ],
      },
    ])
  })

  it('shuffles the whole trash back and then damages every opposing Cookie in the chosen order', () => {
    const base = withPurpleTrash(createBattleState(), 15)
    const secondTarget = {
      card: levelledCookie('caramel-arrow-second-target', 1),
      hpCards: [item('caramel-arrow-second-hp-1'), item('caramel-arrow-second-hp-2')],
      rested: false,
      battleEntryId: 'caramel-arrow-second-target:battle:2',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [...base.players['player-one'].battleArea, secondTarget],
        },
      },
    }
    const deckSizeBefore = state.players['player-two'].deck.length
    const effect = effectsOf('BS3-113')[0]
    if (effect.kind !== 'trash-to-deck-all') {
      throw new Error('BS3-113 should start with trash-to-deck-all.')
    }
    const nestedDamage = effect.thenEffects?.[0]
    if (nestedDamage?.kind !== 'damage-all' || !nestedDamage.target) {
      throw new Error('BS3-113 should have sequential nested damage.')
    }
    const orderedTargetIds = getEffectTargetCandidates(
      state,
      sourceContext(),
      nestedDamage.target,
    )
      .map((cookie) => cookie.card.instanceId)
      .reverse()

    const pendingDamage = executeCardEffect(
      state,
      sourceContext(),
      effect,
      orderedTargetIds,
      (cards) => cards,
    )

    expect(pendingDamage.players['player-two'].discardPile).toHaveLength(0)
    expect(pendingDamage.players['player-two'].deck).toHaveLength(deckSizeBefore + 15)
    expect(pendingDamage.pendingBattle).toMatchObject({
      targetInstanceId: orderedTargetIds[0],
      effectDamageSequence: {
        remainingTargetInstanceIds: [orderedTargetIds[1]],
      },
    })

    const afterFirstDamagePoint = resolveNextDamage(pendingDamage)
    expect(afterFirstDamagePoint.pendingBattle?.targetInstanceId).toBe(orderedTargetIds[0])

    const afterFirstTarget = resolveNextDamage(afterFirstDamagePoint)
    expect(afterFirstTarget.pendingBattle?.targetInstanceId).toBe(orderedTargetIds[1])
  })

  it('throws when the purple trash threshold is not met', () => {
    const state = withPurpleTrash(createBattleState(), 14)

    expect(() =>
      executeCardEffect(state, sourceContext(), effectsOf('BS3-113')[0], []),
    ).toThrowError()
  })
})
