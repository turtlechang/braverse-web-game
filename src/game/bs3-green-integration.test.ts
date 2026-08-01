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
  isEffectConditionMet,
} from './effects'
import { resolveFaintEffect } from './battle'
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
  it('converts the support-area cost as a mandatory leading effect, not CardSkill.cost', () => {
    // 「place 1 card from your support area into the trash」是這個昏厥觸發
    // 技能的代價，但 resolveFaintEffect 只讀 hand-to-battle 的 energyCost，
    // 完全不會去看 CardSkill.cost（同一類問題見 BS3-029）。改成陣列最前面
    // 一個非 optional 的 support-to-trash 效果，才能真正被扣掉。
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-061'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('passive')
    expect(skill!.effects).toHaveLength(2)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'support-to-trash',
      amount: 1,
    })
    expect(skill!.effects[1]).toMatchObject({
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })

  it('damage-all targets all opponent cookies once the sacrifice leaves 5+ remaining', () => {
    let state = createBattleState()
    state = withSupport(state, 'player-two', Array.from({ length: 6 }, (_, i) => ({ id: `sup-${i}` })))
    state = withOpponentAlly(state, levelledCookie('opp-ally', 1, 'red'), ['opp-hp'])

    const [, damageAllEffect] = effectsOf('BS3-061')
    if (damageAllEffect.kind !== 'damage-all') throw new Error('unexpected effect')

    const ctx: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }
    const next = executeCardEffect(state, ctx, damageAllEffect, [])
    const oppCookies = next.players['player-one'].battleArea
    expect(oppCookies.every((c) => c.hpCards.length === 2)).toBe(true)
  })

  it('faint queue actually requires sacrificing a support card before checking the 5+ threshold', () => {
    const source: CookieCard = {
      ...cookie('silverbell'),
      id: 'BS3-061',
      name: 'Silverbell Cookie',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0, supportToTrash: 1 },
        text: '',
        effects: effectsOf('BS3-061'),
        faint: true,
      },
    }
    const [supportToTrashEffect, damageAllEffect] = effectsOf('BS3-061')
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: source.instanceId,
      sourceCardName: source.name,
    }

    let state = createBattleState()
    // createBattleState 預設已給 player-two 1 張支援卡，這裡再補 4 張湊到
    // 恰好 5 張：真的犧牲 1 張後只剩 4 張，未達門檻，不該打群體傷害。
    state = withSupport(state, 'player-two', Array.from({ length: 4 }, (_, i) => ({ id: `sup-${i}` })))
    state.pendingFaintEffects = [
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: source.instanceId,
        sourceCardName: source.name,
        effect: supportToTrashEffect,
        context,
      },
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: source.instanceId,
        sourceCardName: source.name,
        effect: damageAllEffect,
        context,
      },
    ]

    const supportIdToSacrifice =
      state.players['player-two'].supportArea[0].card.instanceId
    let next = resolveFaintEffect(state, [supportIdToSacrifice])
    expect(
      next.players['player-two'].supportArea.some(
        (support) => support.card.instanceId === supportIdToSacrifice,
      ),
    ).toBe(false)
    expect(next.players['player-two'].supportArea).toHaveLength(4)
    expect(next.pendingFaintEffects).toHaveLength(1)

    const defenderHpBefore =
      next.players['player-one'].battleArea[0].hpCards.length
    next = resolveFaintEffect(next, [])
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(next.players['player-one'].battleArea[0].hpCards.length).toBe(
      defenderHpBefore,
    )
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
  it('converts correctly, including the missing "6 or less" threshold', () => {
    // 官方文字「Then, if your support area contains 6 cards or less, set up to
    // 1 card in your support area as active.」——set-active 過去完全沒有這個
    // 條件，等於支援區隨便幾張都會生效。parseCondition 原本只認得「N or
    // more」，沒有對應的「N or less」條件種類，這裡新增 support-count-at-most
    // 並直接寫進這張卡的覆寫。
    const conversion = convertOfficialItemAbility(findBs3Card('BS3-067'))
    expect(conversion).toBeTruthy()
    expect(conversion!.effects).toEqual([
      { kind: 'draw-up-to', max: 2 },
      {
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        condition: { kind: 'support-count-at-most', count: 6 },
      },
    ])
  })

  it('skips set-active when support area has more than 6 cards, applies it at 6 or fewer', () => {
    const [, setActiveEffect] = convertOfficialItemAbility(findBs3Card('BS3-067'))!.effects
    const context: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }

    let state = createBattleState()
    state = withSupport(state, 'player-two', Array.from({ length: 6 }, (_, i) => ({ id: `over-${i}` })))
    // createBattleState 預設已給 1 張，加 6 張變 7 張（> 6），不該生效。
    expect(state.players['player-two'].supportArea).toHaveLength(7)
    expect(isEffectConditionMet(state, context, setActiveEffect)).toBe(false)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          supportArea: state.players['player-two'].supportArea.slice(0, 6),
        },
      },
    }
    expect(state.players['player-two'].supportArea).toHaveLength(6)
    expect(isEffectConditionMet(state, context, setActiveEffect)).toBe(true)
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
    // 官方文字「if your support area contains 5 or more, draw up to 2
    // cards ... and discard 1 card」是單一個複合子句（一個條件，抽牌接棄牌
    // 兩個動作），不是兩個各自獨立判斷同一條件的效果。過去拆成 draw-up-to
    // 與 discard-hand 兩個獨立效果，會被 playTrap 的陷阱效果迴圈連續呼叫
    // executeCardEffect（迴圈只在 pendingRevealTopDeck 時 break，
    // pendingDrawUpTo 不會），導致 pendingDrawUpTo 與
    // pendingOpponentHandDiscard 在同一次結算裡就同時被設置，UI 只是剛好
    // 疊圖只顯示前者，玩家看起來像是抽完牌後又跳出一個「無關」的棄牌視窗。
    // 改用跟 BS3-088 一樣的 draw-up-to-then-discard 複合效果，才會走
    // resolveDrawUpTo 的 afterEffects 銜接流程，UI 才能正確顯示「步驟 1/2
    // → 2/2」的接續提示（見 chainedFromDrawUpTo）。
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
        kind: 'draw-up-to-then-discard',
        max: 2,
        discardCount: 1,
        condition: { kind: 'support-count-at-least', count: 5 },
      },
    ])
  })
})

describe('BS3-071 Ancient Silver Tree: stage disable-flip', () => {
  it('converts correctly, including the missing "selected Cookie is LV.3" self-trash', () => {
    // 官方文字最後一句「If a selected Cookie is LV.3, place this card in the
    // trash.」過去完全沒轉換——這個場景卡選好目標關閉 FLIP 之後，若選到的
    // 是 LV.3 餅乾，場景卡本身要送入棄牌區，之前的轉換只有 disable-flip，
    // 這個自我送棄完全遺漏。新增 trashSourceIfTargetLevel 欄位涵蓋。
    const stage = convertOfficialStageAbility(findBs3Card('BS3-071'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toEqual([
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 2 },
        trashSourceIfTargetLevel: 3,
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

  it('selecting a LV.3 Cookie also sends the stage itself to the trash', () => {
    let state = createBattleState()
    state = withOpponentAlly(state, levelledCookie('opp-lv3', 3, 'red'), ['flip-hp'])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          stage: { card: item('attacker'), rested: false },
        },
      },
    }

    const stage = convertOfficialStageAbility(findBs3Card('BS3-071'))
    const effect = stage!.effects[0]
    if (effect.kind !== 'disable-flip') throw new Error('unexpected effect')

    const ctx: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }
    const next = executeCardEffect(state, ctx, effect, ['opp-lv3'])
    expect(next.flipDisabledUntilTurn!['opp-lv3']).toBe(state.turnNumber)
    expect(next.players['player-two'].stage).toBeNull()
    expect(
      next.players['player-two'].discardPile.some(
        (card) => card.instanceId === 'attacker',
      ),
    ).toBe(true)
  })

  it('selecting a non-LV.3 Cookie keeps the stage in play', () => {
    let state = createBattleState()
    state = withOpponentAlly(state, levelledCookie('opp-lv1', 1, 'red'), ['flip-hp'])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          stage: { card: item('attacker'), rested: false },
        },
      },
    }

    const stage = convertOfficialStageAbility(findBs3Card('BS3-071'))
    const effect = stage!.effects[0]
    if (effect.kind !== 'disable-flip') throw new Error('unexpected effect')

    const ctx: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }
    const next = executeCardEffect(state, ctx, effect, ['opp-lv1'])
    expect(next.flipDisabledUntilTurn!['opp-lv1']).toBe(state.turnNumber)
    expect(next.players['player-two'].stage?.card.instanceId).toBe('attacker')
  })
})

describe('BS3-072 Mystical Faerie Kingdom: stage rest-support', () => {
  it('converts correctly via stage ability, including the missing "opponent support 5+" threshold', () => {
    // 官方文字「If your opponent's support area contains 5 or more, select up
    // to 1 active card from your opponent's support area. Rest that card.」
    // ——這個門檻檢查的是「對手」支援區張數，跟既有的 support-count-at-least
    // （檢查來源自己的支援區）是不同對象，過去完全沒編碼，等於對手支援區
    // 隨便幾張都能被壓制。新增 opponent-support-count-at-least 條件種類。
    const stage = convertOfficialStageAbility(findBs3Card('BS3-072'))
    expect(stage).toBeTruthy()
    expect(stage!.effects).toEqual([
      {
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        optional: true,
        condition: { kind: 'opponent-support-count-at-least', count: 5 },
      },
    ])
  })

  it('rest-support rests an active opponent support card', () => {
    let state = createBattleState()
    // 支付門檻要求對手支援區至少 5 張，先補到位再驗證執行結果。
    state = withSupport(state, 'player-one', [
      { id: 'filler-1' },
      { id: 'filler-2' },
      { id: 'opp-sup', rested: false },
    ])

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

  it('is only usable when the opponent has 5 or more support cards', () => {
    const stage = convertOfficialStageAbility(findBs3Card('BS3-072'))
    const effect = stage!.effects[0]
    const context: EffectContext = { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' }

    let state = createBattleState()
    // createBattleState 預設已給 player-one 2 張支援卡，加 2 張變 4 張（< 5）。
    state = withSupport(state, 'player-one', Array.from({ length: 2 }, (_, i) => ({ id: `opp-sup-${i}` })))
    expect(state.players['player-one'].supportArea).toHaveLength(4)
    expect(isEffectConditionMet(state, context, effect)).toBe(false)

    state = withSupport(state, 'player-one', [{ id: 'opp-sup-4' }])
    expect(state.players['player-one'].supportArea).toHaveLength(5)
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })
})
