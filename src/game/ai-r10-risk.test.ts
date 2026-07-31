import { describe, expect, it } from 'vitest'
import { isRuleEnabled } from './ai/rule-profiles'
import {
  resetR10Counters,
  getR10Counters,
  responseRiskPenalty,
} from './ai/evaluated-turn-handler'
import type {
  CookieCard,
  CookieInBattle,
  GameState,
  PlayerId,
  PlayerState,
  GameCard,
} from './types'
import type { AttackCommand, PlayerActionCommand } from './commands'

describe('R10: 對手回應風險評估', () => {
  describe('規則啟用狀態', () => {
    it('Lv.2 不啟用 R10', () => {
      expect(isRuleEnabled(2, 'R10')).toBe(false)
    })

    it('Lv.3 不啟用 R10', () => {
      expect(isRuleEnabled(3, 'R10')).toBe(false)
    })

    it('Lv.4 啟用 R10', () => {
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })
  })

  describe('R10 實作驗證', () => {
    it('R10 作為 guardrail 疊加在 lv4RiskBonus 之上', () => {
      // R10 使用 responseRiskPenalty 以 += 方式疊加（負值＝風險）
      // 不取代 lv4RiskBonus（若 lv4RiskBonus 被移除，勝率會暴跌）
      // 由 benchmark 驗證：Lv.4 vs Lv.3 = 73.3%，在 60%–75% 區間
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })

    it('R10 不取代 lv4RiskBonus', () => {
      // lv4RiskBonus 是 Lv.4 核心風險評分
      // R10 只能疊加，不可取代或刪除
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })

    it('R10 不讀取對手隱藏資訊', () => {
      // R10 只使用公開 break area / battleArea / hand.length 資訊
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })
  })

  // ==========================================================================
  // responseRiskPenalty 直接單元測試（完整版行為）
  //
  // 完整版新增 F1 「攻擊者反擊暴露」並修正 F0 break race risk 的疊加方向
  // （caller 由 -= 改為 +=，使負值 penalty 真正變成 score 的扣分）。
  // 下列測試對 responseRiskPenalty 純函式做輸入／輸出與 R10 計數驗證。
  // ==========================================================================

  const cookieCard = (
    instanceId: string,
    level: number,
    attack: number,
    hp: number,
  ): CookieCard => ({
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'cookie',
    level,
    attack,
    hp,
    attackCost: 1,
  })

  const cookieInBattle = (
    card: CookieCard,
    hpCount: number,
    rested: boolean,
  ): CookieInBattle => ({
    card,
    hpCards: Array.from({ length: hpCount }, () => card as GameCard),
    rested,
    battleEntryId: `${card.instanceId}:battle:test`,
  })

  const buildPlayer = (
    id: PlayerId,
    fields: Partial<PlayerState> = {},
  ): PlayerState => ({
    id,
    name: id,
    deck: [],
    hand: [],
    battleArea: [],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
    hasMulliganed: true,
    startingCookieSelected: true,
    ...fields,
  })

  const buildState = (
    p1: Partial<PlayerState> = {},
    p2: Partial<PlayerState> = {},
  ): GameState => ({
    players: {
      'player-one': buildPlayer('player-one', p1),
      'player-two': buildPlayer('player-two', p2),
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 5,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 1,
    attackModifiers: [],
    damageReceivedModifiers: [],
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: null,
  })

  const advanceCommand = (playerId: PlayerId): PlayerActionCommand => ({
    kind: 'advance-phase',
    playerId,
  })

  const attackCommand = (
    playerId: PlayerId,
    attackerInstanceId: string,
    targetInstanceId = 'opp-target',
  ): AttackCommand => ({
    kind: 'attack',
    playerId,
    attackerInstanceId,
    targetInstanceId,
    supportPaymentIds: [],
  })

  /** 建構 trigger F1 完整成立的 fixture：高 Level 餘下休息 attacker、對手有反擊資源。 */
  const buildF1HappyFixture = (overrides: {
    preMyBreakCards?: CookieCard[]
    postAttackerLevel?: number
    postAttackerHp?: number
    oppUnrestedAttackSum?: number
    oppHandCount?: number
    oppExtraNonAttacker?: boolean
  }): { pre: GameState; post: GameState; command: AttackCommand } => {
    const attackerLevel = overrides.postAttackerLevel ?? 3
    const attackerHpCount = overrides.postAttackerHp ?? 2
    const oppAtk = overrides.oppUnrestedAttackSum ?? 3
    const oppHand = overrides.oppHandCount ?? 5
    const oppAttackCard = cookieCard('opp-counter', 2, oppAtk, 2)
    const oppBattle: CookieInBattle[] = [
      // 對手未休息反擊者
      cookieInBattle(oppAttackCard, oppAttackCard.hp, false),
      ...(overrides.oppExtraNonAttacker
        ? [cookieInBattle(cookieCard('opp-dummy', 1, 0, 1), 1, false)]
        : []),
    ]
    // 對手手牌：任意公開「張數」即可
    const oppHandArr = Array.from({ length: oppHand }, (_, i) =>
      cookieCard(`opp-hand-${i}`, 1, 1, 1),
    ) as unknown as GameCard[]

    const preBreakCards =
      overrides.preMyBreakCards ??
      [cookieCard('my-br1', 4, 0, 1), cookieCard('my-br2', 4, 0, 1)]

    const attackerCard = cookieCard('my-attacker', attackerLevel, oppAtk + 1, 3)
    const postMyBattle: CookieInBattle[] = [
      cookieInBattle(attackerCard, attackerHpCount, true),
      cookieInBattle(cookieCard('my-other', 1, 1, 1), 1, false),
    ]

    const pre = buildState(
      { breakArea: preBreakCards, battleArea: [cookieInBattle(attackerCard, 3, false)] },
      { breakArea: [], hand: oppHandArr, battleArea: oppBattle },
    )
    const post = buildState(
      { breakArea: preBreakCards, battleArea: postMyBattle },
      { breakArea: [], hand: oppHandArr, battleArea: oppBattle },
    )
    const command = attackCommand('player-one', attackerCard.instanceId)

    return { pre, post, command }
  }

  describe('R10 完整版：responseRiskPenalty 純函式', () => {
    it('F1 觸發：高 Level attacker 休息、對手有反擊資源 → 回傳負數 penalty', () => {
      resetR10Counters()
      const { pre, post, command } = buildF1HappyFixture({})

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      // 預期：基礎 -12 + (level 3 → -6) + (oppHand 5 → minus min(5-3,3)*2 = -4) = -22
      expect(penalty).toBe(-22)
      const counters = getR10Counters()
      expect(counters.exposureRisk).toBe(1)
      expect(counters.penaltyApplied).toBe(1)
      // F0 未觸發（pre break = 8 但 post break 沒變）
      expect(counters.breakRaceRisk).toBe(0)
    })

    it('F1 不觸發等級門檻不足：attacker level === 1', () => {
      resetR10Counters()
      const { pre, post, command } = buildF1HappyFixture({
        postAttackerLevel: 1,
      })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      expect(penalty).toBe(0)
      expect(getR10Counters().exposureRisk).toBe(0)
      expect(getR10Counters().penaltyApplied).toBe(0)
    })

    it('F1 不觸發：對手未休息攻擊力不足以擊倒 attacker', () => {
      resetR10Counters()
      // attacker HP=2，但對手未休息攻擊力只有 1
      const { pre, post, command } = buildF1HappyFixture({
        oppUnrestedAttackSum: 1,
        postAttackerHp: 2,
      })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      expect(penalty).toBe(0)
      expect(getR10Counters().exposureRisk).toBe(0)
    })

    it('F1 不觸發：對手手牌張數 < 3（無 FLIP/trap proxy）', () => {
      resetR10Counters()
      const { pre, post, command } = buildF1HappyFixture({
        oppHandCount: 2,
      })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      expect(penalty).toBe(0)
      expect(getR10Counters().exposureRisk).toBe(0)
    })

    it('F1 不觸發：我方 break 中等以下（preMyBreak < 6）', () => {
      resetR10Counters()
      const { pre, post, command } = buildF1HappyFixture({
        preMyBreakCards: [cookieCard('my-br1', 2, 0, 1), cookieCard('my-br2', 2, 0, 1)],
        // pre break sum = 4 < 6
      })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      expect(penalty).toBe(0)
      expect(getR10Counters().exposureRisk).toBe(0)
    })

    it('F1 不觸發：attacker 已被反擊破壞（不在 post battleArea）', () => {
      resetR10Counters()
      const { pre, post, command } = buildF1HappyFixture({})
      // 把 attacker 從 post battleArea 拿掉，模擬被反擊破壞
      const postNoAttacker: GameState = {
        ...post,
        players: {
          ...post.players,
          'player-one': {
            ...post.players['player-one'],
            battleArea: post.players['player-one'].battleArea.filter(
              (c) => c.card.instanceId !== command.attackerInstanceId,
            ),
          },
        },
      }

      const penalty = responseRiskPenalty(pre, postNoAttacker, 'player-one', command)

      expect(penalty).toBe(0)
      expect(getR10Counters().exposureRisk).toBe(0)
    })

    it('F0 break race risk 觸發方向正確（負值＝扣分，疊加為 += 而非 -=）', () => {
      resetR10Counters()
      // pre break = 8，post break 增為 9（攻擊者被反擊破壞範例）
      const preBreak = [cookieCard('my-br1', 4, 0, 1), cookieCard('my-br2', 4, 0, 1)]
      const postBreak = [...preBreak, cookieCard('my-br3', 1, 0, 1)]

      // 用 non-attack command 隔離 F1，只測 F0 方向
      const command = advanceCommand('player-one')
      const pre = buildState({ breakArea: preBreak })
      const post = buildState({ breakArea: postBreak })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      // F0：breakWorsened = 1 → penalty -= 12 → penalty = -12
      expect(penalty).toBe(-12)
      const counters = getR10Counters()
      expect(counters.breakRaceRisk).toBe(1)
      expect(counters.exposureRisk).toBe(0)
      expect(counters.penaltyApplied).toBe(1)
    })

    it('F0 累積：break 增 2 級 → penalty -= 24', () => {
      resetR10Counters()
      const preBreak = [
        cookieCard('my-br1', 4, 0, 1),
        cookieCard('my-br2', 4, 0, 1),
      ]
      const postBreak = [...preBreak, cookieCard('my-br3', 2, 0, 1)]
      const command = advanceCommand('player-one')
      const pre = buildState({ breakArea: preBreak })
      const post = buildState({ breakArea: postBreak })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      expect(penalty).toBe(-24)
      expect(getR10Counters().breakRaceRisk).toBe(1)
    })

    it('F0 不觸發：preMyBreak 未達 8', () => {
      resetR10Counters()
      const preBreak = [cookieCard('my-br1', 4, 0, 1), cookieCard('my-br2', 3, 0, 1)]
      const postBreak = [...preBreak, cookieCard('my-br3', 1, 0, 1)]
      const command = advanceCommand('player-one')
      const pre = buildState({ breakArea: preBreak })
      const post = buildState({ breakArea: postBreak })

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      // pre break = 7 < 8 → 不觸發
      expect(penalty).toBe(0)
      expect(getR10Counters().breakRaceRisk).toBe(0)
    })

    it('F0 + F1 同時觸發：penalty 嚴格為負、計數都加 1', () => {
      resetR10Counters()
      // pre break = 8、攻擊令 attacker 休息但被 trap 反擊破壞（post break 增 1 級）
      const preBreak = [cookieCard('my-br1', 4, 0, 1), cookieCard('my-br2', 4, 0, 1)]
      const attackerCard = cookieCard('my-attacker', 3, 5, 3)
      const oppAttackCard = cookieCard('opp-counter', 2, 4, 2)
      const oppHandArr = Array.from({ length: 3 }, (_, i) =>
        cookieCard(`opp-hand-${i}`, 1, 1, 1),
      ) as unknown as GameCard[]
      const oppBattle = [cookieInBattle(oppAttackCard, 2, false)]

      const pre = buildState(
        { breakArea: preBreak, battleArea: [cookieInBattle(attackerCard, 3, false)] },
        { hand: oppHandArr, battleArea: oppBattle },
      )
      // post：attacker 仍休息且活著、break 增 1 級
      const post = buildState(
        {
          breakArea: [...preBreak, cookieCard('my-br3', 1, 0, 1)],
          battleArea: [cookieInBattle(attackerCard, 2, true)],
        },
        { hand: oppHandArr, battleArea: oppBattle },
      )
      const command = attackCommand('player-one', attackerCard.instanceId)

      const penalty = responseRiskPenalty(pre, post, 'player-one', command)

      // F0: -12；F1: -12 + -6 + min(3-3,3)*2 = -18；合計 = -30
      expect(penalty).toBe(-30)
      const counters = getR10Counters()
      expect(counters.breakRaceRisk).toBe(1)
      expect(counters.exposureRisk).toBe(1)
      expect(counters.penaltyApplied).toBe(1)
    })

    it('F1 額外手牌加成封頂：oppHand 超過 5 後 penalty 不再增加', () => {
      resetR10Counters()
      const { pre: preSmall, post: postSmall, command: cmdSmall } =
        buildF1HappyFixture({ oppHandCount: 5 })
      resetR10Counters()
      const penalty5 = responseRiskPenalty(
        preSmall, postSmall, 'player-one', cmdSmall,
      )

      resetR10Counters()
      const { pre: preLarge, post: postLarge, command: cmdLarge } =
        buildF1HappyFixture({ oppHandCount: 10 })
      const penalty10 = responseRiskPenalty(
        preLarge, postLarge, 'player-one', cmdLarge,
      )

      // oppHand 5 → 額外 (5-3)=2 → +4；oppHand 10 → clamp at 3 → +6
      // 兩者差應為 2（封頂在 +6）
      expect(penalty10 - penalty5).toBe(-2)
    })
  })
})