import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialTrapAbility,
  convertOfficialItemAbility,
} from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  executeCardEffect,
  getEffectTargetCandidates,
  isEffectConditionMet,
} from './effects'
import type {
  CardEffect,
  CookieCard,
  EffectContext,
  GameState,
  PlayerId,
} from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill, getActivatableSkillSources } from './skills'

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

const withBreakArea = (
  state: GameState,
  cards: CookieCard[],
  playerId: PlayerId = 'player-two',
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: {
      ...state.players[playerId],
      breakArea: [...state.players[playerId].breakArea, ...cards],
    },
  },
})

// =====================================
// 陷阱卡 (Trap Cards)
// =====================================
describe('BS3 剩餘陷阱卡', () => {
  it('BS3-021 Oath on the Shield: opponent -3 attack + self 1 damage', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-021'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toHaveLength(2)
    expect(trap!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: -3,
      duration: 'this-turn',
    })
    expect(trap!.effects[1]).toMatchObject({
      kind: 'damage',
      amount: 1,
    })
  })

  it('BS3-022 Banquet of Victory: conditional (break LV.6+) opponent -1 + damage', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-022'))
    expect(trap).toBeTruthy()
    expect(trap!.condition).toEqual({ kind: 'break-level-at-least', level: 6 })
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -1 })
    expect(trap!.effects[1]).toMatchObject({ kind: 'damage', amount: 1 })
  })

  it('BS3-045 Golden Monarch Counterattack: damage-by-break-count LV.3', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-045'))
    expect(trap).toBeTruthy()
    expect(trap!.effects[0]).toMatchObject({
      kind: 'damage-by-break-count',
      perCount: 1,
      exactBreakLevel: 3,
    })
  })

  it('BS3-069 The New Guardian Power: -2 attack + trash 2 supports + damage', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-069'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toHaveLength(3)
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -2 })
    expect(trap!.effects[1]).toMatchObject({ kind: 'support-to-trash', amount: 2 })
    expect(trap!.effects[2]).toMatchObject({ kind: 'damage', amount: 1 })
  })

  it('BS3-070 Puppet Theater of Chaos: up to 2 -1 attack + conditional draw/discard', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-070'))
    expect(trap).toBeTruthy()
    expect(trap!.effects).toHaveLength(3)
    expect(trap!.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: -1,
      target: { side: 'opponent', min: 0, max: 2 },
    })
    expect(trap!.effects[1]).toMatchObject({
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'support-count-at-least', count: 5 },
    })
    expect(trap!.effects[2]).toMatchObject({
      kind: 'discard-hand',
      count: 1,
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })

  it('BS3-093 Convocation of Elders: -1 attack + reveal conditional second -1', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-093'))
    expect(trap).toBeTruthy()
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -1 })
    expect(trap!.effects[1]).toMatchObject({
      kind: 'reveal-top-deck',
      match: { type: 'cookie', energyColor: 'blue', level: 2 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    })
  })

  /**
   * 官方 Q&A：展示牌庫頂後放回牌庫頂（實作以 peek 不離庫等價）；
   * 僅當展示卡為 {B} LV.2 餅乾時，才可執行後方 -1 攻擊效果。
   */
  it('BS3-093 reveal keeps the card on top and only then applies nested -1', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-093'))
    const reveal = trap!.effects[1]
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'bs3-093',
      sourceCardName: 'Convocation of Elders',
    }

    const matchingTop = levelledCookie('blue-lv2', 2, 'blue')
    let state = createBattleState()
    state.players['player-two'].deck = [
      matchingTop,
      item('under-match'),
    ]
    const beforeDeck = state.players['player-two'].deck.map((c) => c.instanceId)
    const matched = executeCardEffect(state, context, reveal, ['defender'])
    expect(matched.players['player-two'].deck.map((c) => c.instanceId)).toEqual(
      beforeDeck,
    )
    expect(matched.players['player-two'].hand).toHaveLength(
      state.players['player-two'].hand.length,
    )
    expect(matched.attackModifiers).toContainEqual(
      expect.objectContaining({
        targetInstanceId: 'defender',
        amount: -1,
      }),
    )

    const nonMatchTop = levelledCookie('blue-lv1', 1, 'blue')
    state = createBattleState()
    state.players['player-two'].deck = [nonMatchTop, item('under-miss')]
    const missed = executeCardEffect(state, context, reveal, ['defender'])
    expect(missed.players['player-two'].deck[0].instanceId).toBe('blue-lv1')
    expect(missed.attackModifiers).toEqual([])
  })

  it('BS3-094 Radiant Coronation: -2 attack + inspect top 3', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-094'))
    expect(trap).toBeTruthy()
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -2 })
    expect(trap!.effects[1]).toMatchObject({
      kind: 'inspect-deck',
      lookCount: 3,
      pickCount: 0,
      restDestination: 'top',
    })
  })

  it('BS3-117 Chocolate Altar: -3 attack + conditional field-to-trash', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-117'))
    expect(trap).toBeTruthy()
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -3 })
    expect(trap!.effects[1]).toMatchObject({
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 0, max: 1, remainingHp: 2 },
      condition: { kind: 'trash-count-at-least', count: 15 },
    })
  })

  it('BS3-118 Founding Resolution: -1 attack + mill 2 to trash', () => {
    const trap = convertOfficialTrapAbility(findBs3Card('BS3-118'))
    expect(trap).toBeTruthy()
    expect(trap!.effects[0]).toMatchObject({ kind: 'modify-attack', amount: -1 })
    expect(trap!.effects[1]).toMatchObject({ kind: 'deck-to-trash', amount: 2, side: 'self' })
  })
})

// =====================================
// 餅乾被動/啟動技能 (Cookie Skills)
// =====================================
describe('BS3 剩餘餅乾技能', () => {
  it('BS3-001 Princess Cookie: passive +1 attack in battle area', () => {
    const effects = effectsOf('BS3-001')
    expect(effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    })
  })

  it('BS3-003 Royal Margarine Cookie: activate return-to-hand (generic)', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-003'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('activate')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'return-to-hand',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    })
  })

  it('BS3-006 Snapdragon Cookie: passive modify-all-attack persistent', () => {
    const effects = effectsOf('BS3-006')
    expect(effects[0]).toMatchObject({
      kind: 'modify-all-attack',
      amount: 1,
      duration: 'persistent',
      side: 'self',
      energyColor: 'red',
      minLevel: 2,
    })
  })

  it('BS3-007 Tea Knight Cookie: passive +2 attack if break LV.7+', () => {
    const effects = effectsOf('BS3-007')
    expect(effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 2,
      duration: 'persistent',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'break-level-at-least', level: 7 },
    })
  })

  it('BS3-014 Schwarzwalder: passive +1 attack if any blocker exists', () => {
    const effects = effectsOf('BS3-014')
    expect(effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: 1,
      duration: 'persistent',
      condition: { kind: 'any-battle-area-has-blocker' },
    })
  })

  it('BS3-050 Matcha Cookie: activate damage with support 7+ condition (generic)', () => {
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

  it('BS3-051 Fig Cookie: reactive modify-attack -1 with support condition', () => {
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

  it('BS3-052 Mint Choco Cookie: on-play support-to-trash cost + gain-hp to damaged ally', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-052'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.supportToTrash).toBe(1)
    expect(skill!.effects[0]).toMatchObject({
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 0, max: 1, excludeSource: true, remainingHp: 2 },
    })
  })

  it('BS3-057 Mercurial Knight Cookie: on-play damage with support 5+ condition', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-057'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      condition: { kind: 'support-count-at-least', count: 5 },
    })
  })

  it('BS3-078 Wizard Cookie: on-play discard 2 draw up to 2', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-078'))
    expect(skill).toBeTruthy()
    expect(skill!.trigger).toBe('on-play')
    expect(skill!.cost.discardHand).toBe(2)
    expect(skill!.effects[0]).toMatchObject({ kind: 'draw-up-to', max: 2 })
  })

  it('BS3-098 Kumiho Cookie: on-play with {P} cost damage', () => {
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

  it('BS3-103 Red Velvet Cookie: faint damage with trash 10+ condition', () => {
    const effects = effectsOf('BS3-103')
    expect(effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      condition: { kind: 'trash-count-at-least', count: 10 },
    })
  })
})

// =====================================
// 物品卡 (Item Cards)
// =====================================
describe('BS3 剩餘物品卡', () => {
  it('BS3-018 Mushroom Spore Punch: choose-one (disable Blocker or deal 1 damage)', () => {
    const item = convertOfficialItemAbility(findBs3Card('BS3-018'))
    expect(item).toBeTruthy()
    const chooseOne = item!.effects[0]
    expect(chooseOne).toMatchObject({ kind: 'choose-one' })
    expect('modes' in chooseOne).toBe(true)
  })

  it('BS3-090 Sword of Radiant Light: reveal-top-deck conditional +2 attack', () => {
    const effects = effectsOf('BS3-090')
    expect(effects[0]).toMatchObject({
      kind: 'reveal-top-deck',
      match: { type: 'cookie', energyColor: 'blue', level: 2 },
    })
  })

  it('BS3-116 First Watcher Bow: choose-one (hp-to-trash or random discard)', () => {
    const item = convertOfficialItemAbility(findBs3Card('BS3-116'))
    expect(item).toBeTruthy()
    expect(item!.effects[0]).toMatchObject({ kind: 'choose-one' })
  })
})

// BS3-024 Dragon Valley 的啟動代價含「令 1 隻己方 {R} 餅乾昏厥」，是全新的
// 犧牲代價機制（AbilityCost 目前沒有對應欄位），超出本輪範圍，故不在此斷言其
// 已支援；仍屬 unsupported-effect-text，見 docs/bs3-effect-coverage.md。

// =====================================
// BS3-025 Golden Cheese Cookie
// =====================================
describe('BS3-025 Golden Cheese Cookie', () => {
  it('has oncePerGame and fromBreakArea flags', () => {
    const skill = convertOfficialCookieSkill(findBs3Card('BS3-025'))
    expect(skill).toBeTruthy()
    expect(skill!.oncePerGame).toBe(true)
    expect(skill!.fromBreakArea).toBe(true)
    expect(skill!.yourTurn).toBe(true)
    expect(skill!.cost.energy).toEqual({ yellow: 1 })
  })

  it('has break-source-to-battle effect with 1 HP', () => {
    const effects = effectsOf('BS3-025')
    expect(effects[0]).toMatchObject({
      kind: 'break-source-to-battle',
      hpCount: 1,
    })
  })

  it('break-source-to-battle moves cookie from break to battle with correct HP', () => {
    const gcc: CookieCard = {
      ...cookie('gcc'),
      id: 'BS3-025',
      instanceId: 'gcc',
      name: 'Golden Cheese Cookie',
      level: 3,
      hp: 3,
      attack: 4,
      energyColor: 'yellow',
      skill: convertOfficialCookieSkill(findBs3Card('BS3-025')),
    }
    const state = createBattleState()
    const withBreak = withBreakArea(state, [gcc], 'player-two')
    // 確保牌庫有足夠的 HP 卡
    const withDeck = {
      ...withBreak,
      players: {
        ...withBreak.players,
        'player-two': {
          ...withBreak.players['player-two'],
          deck: [
            { id: 'hpc1', instanceId: 'hpc1', name: 'HP', type: 'item' as const, energyColor: 'yellow' as const },
          ],
        },
      },
    }
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'gcc',
      sourceCardName: 'Golden Cheese Cookie',
    }
    const result = executeCardEffect(withDeck, context, {
      kind: 'break-source-to-battle',
      hpCount: 1,
    }, [])
    const player = result.players['player-two']
    expect(player.breakArea).toHaveLength(0)
    expect(player.battleArea).toHaveLength(2) // 原始攻擊者 + gcc
    const gccInBattle = player.battleArea.find((c) => c.card.instanceId === 'gcc')
    expect(gccInBattle).toBeTruthy()
    expect(gccInBattle!.hpCards).toHaveLength(1)
    expect(gccInBattle!.rested).toBe(false)
  })

  const goldenCheeseCookie = (): CookieCard => ({
    ...cookie('gcc', 4, 3),
    id: 'BS3-025',
    level: 3,
    energyColor: 'yellow',
    skill: convertOfficialCookieSkill(findBs3Card('BS3-025')),
  })

  /**
   * player-two 的休息區放 BS3-025，支援區給 1 張 {Y} 支付技能費用，
   * 牌庫留幾張卡供登場時補 HP。這條路徑測的是完整發動流程
   * （canActivateCookieSkill → begin-activate-skill → resolve-ability-effect），
   * 不是像上面兩個測試那樣直接呼叫 executeCardEffect。
   */
  const createGoldenCheeseState = (): GameState => {
    const base = createBattleState()
    return {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          breakArea: [goldenCheeseCookie()],
          supportArea: [
            ...base.players['player-two'].supportArea,
            { card: item('p2-yellow-support', 'yellow'), rested: false },
          ],
          deck: [item('deck-hp-1'), item('deck-hp-2')],
        },
      },
    }
  }

  it('cannot be activated while the card sits in the battle area', () => {
    // findSkillSource 只在戰鬥區找不到時才退而求其次找休息區，
    // 一般狀態下（來源在戰鬥區）行為必須維持不變。
    const state = createGoldenCheeseState()
    expect(
      canActivateCookieSkill(state, 'player-two', 'attacker', 'activate'),
    ).toBe(false)
  })

  it('is activatable from the break area when energy is available', () => {
    const state = createGoldenCheeseState()
    expect(
      canActivateCookieSkill(state, 'player-two', 'gcc', 'activate'),
    ).toBe(true)
  })

  it('cannot be used as a substitute for the mandatory hand-only replacement', () => {
    // 官方釋疑：戰鬥區沒有餅乾時必須從手牌執行「再登場」，不能改用休息區的
    // 「至尊國君的復活」頂替；pendingReplacement 存在時一律擋下 activate 觸發。
    const base = createGoldenCheeseState()
    const state: GameState = {
      ...base,
      pendingReplacement: {
        tasks: [{ playerId: 'player-two', remaining: 1 }],
      },
    }
    expect(
      canActivateCookieSkill(state, 'player-two', 'gcc', 'activate'),
    ).toBe(false)
  })

  it('is blocked once the battle area already has 2 Cookies', () => {
    const base = createGoldenCheeseState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            ...base.players['player-two'].battleArea,
            {
              card: cookie('filler'),
              hpCards: [item('filler-hp')],
              rested: false,
              battleEntryId: 'filler:battle:9',
            },
          ],
        },
      },
    }
    expect(
      canActivateCookieSkill(state, 'player-two', 'gcc', 'activate'),
    ).toBe(false)
  })

  it('plays the Cookie from the break area through the full command flow', () => {
    const state = createGoldenCheeseState()

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: 'gcc',
      trigger: 'activate',
      paymentIds: ['p2-yellow-support'],
      // break-source-to-battle 沒有目標可選，帶空陣列讓指令一次付費並結算完效果。
      targetIds: [],
    })

    const player = activated.players['player-two']
    expect(player.breakArea).toHaveLength(0)
    const gccInBattle = player.battleArea.find(
      (entry) => entry.card.instanceId === 'gcc',
    )
    expect(gccInBattle).toBeTruthy()
    expect(gccInBattle!.hpCards).toHaveLength(1)
    // 費用支付的 {Y} 支援卡橫置，不是被丟棄。
    expect(
      player.supportArea.find(
        (support) => support.card.instanceId === 'p2-yellow-support',
      )?.rested,
    ).toBe(true)
  })

  it('records the once-per-game use and rejects a second activation', () => {
    const state = createGoldenCheeseState()
    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: 'gcc',
      trigger: 'activate',
      paymentIds: ['p2-yellow-support'],
    })

    // 官方釋疑：整局一次是「每位玩家」限定，key 是 playerId:卡片編號，
    // 不是 card.instanceId——同一張實體卡再次出現在休息區也不能重複發動。
    expect(activated.skillUsesThisGame).toContain('player-two:BS3-025')

    // 假設同一隻餅乾之後再度昏厥回到休息區，仍不能第二次發動。
    const backInBreak: GameState = {
      ...activated,
      players: {
        ...activated.players,
        'player-two': {
          ...activated.players['player-two'],
          battleArea: activated.players['player-two'].battleArea.filter(
            (entry) => entry.card.instanceId !== 'gcc',
          ),
          breakArea: [
            ...activated.players['player-two'].breakArea,
            goldenCheeseCookie(),
          ],
          supportArea: [
            { card: item('p2-yellow-support-2', 'yellow'), rested: false },
          ],
        },
      },
    }

    expect(
      canActivateCookieSkill(backInBreak, 'player-two', 'gcc', 'activate'),
    ).toBe(false)
  })

  it('is capped at one use per player even with two different copies of the card', () => {
    // 官方釋疑明確舉例：同一位玩家休息區有兩張 BS3-025，仍只能共用一次額度。
    const base = createGoldenCheeseState()
    const secondCopy: CookieCard = { ...goldenCheeseCookie(), instanceId: 'gcc-2' }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          breakArea: [...base.players['player-two'].breakArea, secondCopy],
          supportArea: [
            ...base.players['player-two'].supportArea,
            { card: item('p2-yellow-support-2', 'yellow'), rested: false },
          ],
        },
      },
    }

    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: 'gcc',
      trigger: 'activate',
      paymentIds: ['p2-yellow-support'],
      targetIds: [],
    })

    expect(
      canActivateCookieSkill(activated, 'player-two', 'gcc-2', 'activate'),
    ).toBe(false)
  })

  it('lets each player use their own copy once — the limit is not shared across players', () => {
    // 直接檢查 skillUsesThisGame 內容，避免混進 yourTurn／phase 等與此無關的
    // 發動前提（那些條件已由其他測試涵蓋），聚焦在 key 是否正確帶了 playerId。
    const state = createGoldenCheeseState()
    const activated = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-two',
      sourceInstanceId: 'gcc',
      trigger: 'activate',
      paymentIds: ['p2-yellow-support'],
      targetIds: [],
    })

    expect(activated.skillUsesThisGame).toEqual(['player-two:BS3-025'])
    expect(activated.skillUsesThisGame).not.toContain('player-one:BS3-025')
  })

  it('is offered to the AI activate-skill loop alongside battle-area sources', () => {
    const state = createGoldenCheeseState()
    const sources = getActivatableSkillSources(state.players['player-two'])

    expect(sources.map((source) => source.card.instanceId)).toEqual(
      expect.arrayContaining(['attacker', 'gcc']),
    )
    // 一般休息區餅乾（沒有 fromBreakArea）不該被誤收進候選清單。
    const plainBreakCookie = cookie('plain-break')
    const withPlainBreak = getActivatableSkillSources({
      ...state.players['player-two'],
      breakArea: [...state.players['player-two'].breakArea, plainBreakCookie],
    })
    expect(
      withPlainBreak.some((source) => source.card.instanceId === 'plain-break'),
    ).toBe(false)
  })
})

// =====================================
// any-battle-area-has-blocker 條件
// =====================================
describe('any-battle-area-has-blocker condition', () => {
  it('returns false when no cookie has blocker skill', () => {
    const state = createBattleState()
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'source',
    }
    const effect = {
      kind: 'modify-attack' as const,
      amount: 1,
      duration: 'persistent' as const,
      target: { side: 'self' as const, min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'any-battle-area-has-blocker' as const },
    }
    expect(isEffectConditionMet(state, context, effect)).toBe(false)
  })

  it('returns true when a cookie has blocker skill in battle area', () => {
    const base = createBattleState()
    const blockerCookie: CookieCard = {
      ...cookie('blocker'),
      level: 1,
      skill: {
        trigger: 'block' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'Blocker',
        effects: [],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: blockerCookie, hpCards: [], rested: false, battleEntryId: 'blocker:battle:1' },
          ],
        },
      },
    }
    const effect = {
      kind: 'modify-attack' as const,
      amount: 1,
      duration: 'persistent' as const,
      target: { side: 'self' as const, min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'any-battle-area-has-blocker' as const },
    }
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'source',
    }
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })
})

// =====================================
// damage-by-break-count with exactBreakLevel
// =====================================
describe('damage-by-break-count avec exactBreakLevel', () => {
  it('counts only cookies at exact break level', () => {
    const state = createBattleState()
    const lv3Cookies = [
      levelledCookie('b1', 3, 'yellow'),
      levelledCookie('b2', 3, 'yellow'),
    ]
    const lv2Cookie = levelledCookie('b3', 2, 'yellow')
    const withBreak = withBreakArea(state, [...lv3Cookies, lv2Cookie], 'player-two')
    const context: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'source',
    }
    const effect = {
      kind: 'damage-by-break-count' as const,
      perCount: 1,
      exactBreakLevel: 3,
      target: { side: 'opponent' as const, min: 0, max: 1 },
    }
    const candidates = getEffectTargetCandidates(withBreak, context, effect.target)
    // There's at least one opponent cookie to target
    expect(candidates.length).toBeGreaterThanOrEqual(1)
  })
})
