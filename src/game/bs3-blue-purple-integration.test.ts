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
import { activateCookieSkill } from './skills'
import type {
  CardEffect,
  ChooseOneEffect,
  DamageEffect,
  EffectContext,
  GameCard,
  GameState,
  RevealTopDeckEffect,
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

  // BS3-082（GingerBrave）「若手牌 5 張以下，此餅乾不受任何效果傷害」是
  // trigger: 'passive' 的持續性條件被動。在修正前，effectDamagePreventedUntilTurn
  // 只有 executeCardEffect 直接執行 prevent-effect-damage 效果時才會寫入，
  // 但整個引擎沒有任何操作或事件會主動對這張被動技能呼叫 executeCardEffect
  // （不像 support-area-decreased-this-turn／ST5-022 有專用的 pendingStageTrigger
  // 掛鉤），導致這個保護在真實對戰中永遠不會生效。修正後 isEffectDamagePrevented
  // 除了讀快照，也會即時重新檢查目標自己身上 trigger: 'passive' 的
  // prevent-effect-damage 技能條件是否成立。
  it('BS3-082 GingerBrave: passive prevent-effect-damage actually protects when hand <= 5', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-082'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('passive')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'prevent-effect-damage',
      condition: { kind: 'hand-count-at-most', count: 5 },
    })

    const state = createBattleState()
    const gingerBrave = { ...cookie('gb', 3, 3), skill: skill! }
    state.players['player-one'].battleArea = [
      {
        card: gingerBrave,
        hpCards: [item('gb-hp-1'), item('gb-hp-2'), item('gb-hp-3')],
        rested: false,
        battleEntryId: 'gb:battle:1',
      },
    ]
    state.players['player-one'].hand = [item('h1'), item('h2')]

    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'attacker',
    }
    const result = executeCardEffect(
      state,
      context,
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      [],
    )
    const gb = result.players['player-one'].battleArea.find(
      (c) => c.card.instanceId === 'gb',
    )
    expect(gb?.hpCards).toHaveLength(3)
  })

  it('BS3-082 GingerBrave: takes normal effect damage once hand exceeds 5', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-082'))
    const state = createBattleState()
    const gingerBrave = { ...cookie('gb', 3, 3), skill: skill! }
    state.players['player-one'].battleArea = [
      {
        card: gingerBrave,
        hpCards: [item('gb-hp-1'), item('gb-hp-2'), item('gb-hp-3')],
        rested: false,
        battleEntryId: 'gb:battle:1',
      },
    ]
    state.players['player-one'].hand = [
      item('h1'), item('h2'), item('h3'), item('h4'), item('h5'), item('h6'),
    ]

    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'attacker',
    }
    const result = executeCardEffect(
      state,
      context,
      { kind: 'damage-all', amount: 1, side: 'opponent' },
      [],
    )
    const gb = result.players['player-one'].battleArea.find(
      (c) => c.card.instanceId === 'gb',
    )
    expect(gb?.hpCards).toHaveLength(2)
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

  it('BS3-087 reveal-top-deck: match sets pendingRevealTopDeck with matched=true', () => {
    const state = createBattleState()
    const blueCookie = cookie('BS3-088-inst', 1, 3)
    const blueCookieAsCard: GameCard = {
      ...blueCookie,
      energyColor: 'blue',
      level: 2,
    }
    const withDeck: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [blueCookieAsCard, ...state.players['player-one'].deck],
        },
      },
    }
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-087'))
    const revealEffect = skill!.effects[0] as RevealTopDeckEffect
    const next = executeCardEffect(withDeck, sourceContext(), revealEffect, [])
    expect(next.pendingRevealTopDeck).toBeDefined()
    expect(next.pendingRevealTopDeck!.matched).toBe(true)
    expect(next.pendingRevealTopDeck!.revealedCard.instanceId).toBe('BS3-088-inst')
    expect(next.pendingRevealTopDeck!.nestedEffects).toHaveLength(1)
    expect(next.pendingRevealTopDeck!.nestedEffects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
    })
  })

  it('BS3-087 reveal-top-deck: no match sets pendingRevealTopDeck with matched=false', () => {
    const state = createBattleState()
    const redItem: GameCard = {
      id: 'item-red',
      instanceId: 'item-red-inst',
      name: 'Red Item',
      type: 'item',
      energyColor: 'red',
    }
    const withDeck: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [redItem, ...state.players['player-one'].deck],
        },
      },
    }
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-087'))
    const revealEffect = skill!.effects[0] as RevealTopDeckEffect
    const next = executeCardEffect(withDeck, sourceContext(), revealEffect, [])
    expect(next.pendingRevealTopDeck).toBeDefined()
    expect(next.pendingRevealTopDeck!.matched).toBe(false)
    expect(next.pendingRevealTopDeck!.revealedCard.instanceId).toBe('item-red-inst')
    expect(next.pendingRevealTopDeck!.nestedEffects).toHaveLength(0)
  })

  it('BS3-087 reveal-top-deck: no deck cards returns unchanged state', () => {
    const state = createBattleState()
    const emptyDeck: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [],
        },
      },
    }
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-087'))
    const revealEffect = skill!.effects[0] as RevealTopDeckEffect
    const next = executeCardEffect(emptyDeck, sourceContext(), revealEffect, [])
    expect(next.pendingRevealTopDeck ?? undefined).toBeUndefined()
  })

  // BS3-105（Affogato Cookie）技能文字「<Place this Cookie in the trash.>」是
  // 發動代價，比照 BS2-015／BS2-071 用 trashBattleCookie: { sourceOnly: true }
  // 表示。generic parseAbilityCost 只認得「Place N (energy) LV.X Cookie from
  // your battle area into the trash」這種措辭，「this Cookie」是自我指涉、
  // 抓不到，修正前完全沒有把這個代價轉換出來，導致這個技能可以在不犧牲自己
  // 的情況下無限發動。
  it('BS3-105 Affogato Cookie: activating the skill must trash the source cookie', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-105'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.cost.energy).toEqual({ purple: 1 })
    expect(skill!.cost.trashBattleCookie).toEqual({ count: 1, sourceOnly: true })

    const state = createBattleState()
    state.activePlayerId = 'player-one'
    state.players['player-one'].battleArea = [
      {
        card: { ...cookie('affogato', 2, 2), skill: skill! },
        hpCards: [item('hp-1'), item('hp-2')],
        rested: false,
        battleEntryId: 'affogato:battle:1',
      },
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-energy-1', 'purple'), rested: false },
    ]
    state.players['player-one'].deck = [item('d1'), item('d2'), item('d3')]
    state.players['player-two'].deck = [item('e1'), item('e2'), item('e3')]

    const result = activateCookieSkill(
      state,
      'player-one',
      'affogato',
      'activate',
      ['p1-energy-1'],
    )
    const stillInBattle = result.players['player-one'].battleArea.some(
      (c) => c.card.instanceId === 'affogato',
    )
    expect(stillInBattle).toBe(false)
    expect(
      result.players['player-one'].discardPile.some(
        (c) => c.instanceId === 'affogato',
      ),
    ).toBe(true)
  })
})
