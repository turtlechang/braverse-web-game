import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../ai'
import { evaluateBlockWorth, handleAiPendingBattle } from './battle-handler'
import { cookie, createBattleState, declareAttack, item } from '../test-helpers/battle-helpers'
import type { CardSkill, CookieInBattle, GameCard, GameState } from '../types'

/**
 * 原本 AI 選 Blocker 直接取 getBlockerCandidates()[0]，完全沒比較「擋下來
 * 省了多少」跟「Blocker 頂上去可能賠掉多少」。這裡驗證 evaluateBlockWorth
 * 會依這兩者的淨值判斷該不該擋，以及 handleAiPendingBattle 在 Lv.3+ 會真的
 * 用這個分數挑 Blocker、淨值為負時乾脆不擋。
 */

const blockSkill = (): CardSkill => ({
  trigger: 'block',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: {}, discardHand: 0 },
  text: '{bl}',
  effects: [
    {
      kind: 'redirect-attack',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    },
  ],
})

const asBlocker = (
  instanceId: string,
  level: number,
  hp: number,
): CookieInBattle => ({
  card: {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'cookie',
    level,
    hp,
    attack: 1,
    attackCost: 1,
    skill: blockSkill(),
  },
  hpCards: Array.from({ length: hp }, (_, i) => item(`${instanceId}-hp-${i}`)),
  rested: false,
})

describe('evaluateBlockWorth', () => {
  it('值得擋：原目標打得死、Blocker 扛得住', () => {
    let state = createBattleState()
    // defender（Level1 HP3）對上 attacker（攻擊力3）——不擋會死。
    state = declareAttack(state)
    const blocker = asBlocker('tanky-blocker', 1, 5) // HP5，3傷打不死

    const score = evaluateBlockWorth(
      state,
      'player-one',
      blocker,
      state.pendingBattle!,
    )

    // 45（救到 defender：level1*15+hp3*10）- 0（blocker 不會死）
    expect(score).toBe(45)
  })

  it('不值得擋：原目標本來就打不死、Blocker 反而會賠上', () => {
    let state = createBattleState()
    // 把 defender HP 拉高到 5，攻擊力3打不死，不擋也沒事。
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              ...state.players['player-one'].battleArea[0],
              hpCards: [
                item('defender-hp-a'),
                item('defender-hp-b'),
                item('defender-hp-c'),
                item('defender-hp-d'),
                item('defender-hp-e'),
              ],
            },
          ],
        },
      },
    }
    state = declareAttack(state)
    const blocker = asBlocker('fragile-blocker', 1, 1) // HP1，3傷打得死

    const score = evaluateBlockWorth(
      state,
      'player-one',
      blocker,
      state.pendingBattle!,
    )

    // 0（原目標本來就不會死，沒有保護價值）- 25（賠掉 blocker：level1*15+hp1*10）
    expect(score).toBe(-25)
  })

  it('handleAiPendingBattle 在 Lv.3+ 會選淨值較高的 Blocker，而非陣列第一個', () => {
    let state = createBattleState()
    state = declareAttack(state) // defender HP3 對上攻擊力3，不擋會死

    const weakBlocker = asBlocker('weak-blocker', 1, 1) // 會死，賠 25
    const strongBlocker = asBlocker('strong-blocker', 1, 5) // 扛得住，賠 0

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          // 刻意把分數較低的候選放在陣列第一個，驗證不是取 [0]。
          battleArea: [
            ...state.players['player-one'].battleArea,
            weakBlocker,
            strongBlocker,
          ],
        },
      },
    }

    const decision = handleAiPendingBattle(state, 'player-one', 3)

    expect(decision?.action).toBe('play-blocker')
    expect(decision?.description).toContain('strong-blocker')
  })

  it('handleAiPendingBattle 在 Lv.3+ 淨值為負時乾脆不擋', () => {
    let state = createBattleState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              ...state.players['player-one'].battleArea[0],
              hpCards: [
                item('defender-hp-a'),
                item('defender-hp-b'),
                item('defender-hp-c'),
                item('defender-hp-d'),
                item('defender-hp-e'),
              ],
            },
          ],
        },
      },
    }
    state = declareAttack(state) // 原目標打不死

    const fragileBlocker = asBlocker('fragile-blocker', 1, 1) // 擋了會死，不划算
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            ...state.players['player-one'].battleArea,
            fragileBlocker,
          ],
        },
      },
    }

    const decision = handleAiPendingBattle(state, 'player-one', 3)

    expect(decision?.action).toBe('play-trap')
    expect(decision?.description).toContain('未發動陷阱')
  })

  it('takeAiStep 會保留防守決策的 G5 telemetry，而不是只回報舊 action', () => {
    let state = declareAttack(createBattleState())
    const blocker = asBlocker('telemetry-blocker', 1, 5)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            ...state.players['player-one'].battleArea,
            blocker,
          ],
        },
      },
    }

    const decision = takeAiStep(state, 'player-one', { level: 3, seed: 17 })

    expect(decision.action).toBe('play-blocker')
    expect(decision.reason?.pendingStrategy).toMatchObject({
      kind: 'blocker',
      sourceCardId: 'telemetry-blocker',
      usedUniversalSelection: true,
      publicViewOnly: true,
    })
  })
})

/**
 * FLIP 相關：原本只要條件成立就無條件發動，棄牌照手牌順序砍前 N 張。
 * 這裡驗證 Lv.3+ 會依效果價值 vs 棄牌代價判斷該不該發動，且棄牌會優先
 * 挑「捨得丟」的卡，而非固定丟手牌最前面幾張。
 */

const flipCard = (discardHand: number): GameCard => ({
  ...cookie('flip-source'),
  officialType: 'flip',
  flip: {
    text: 'Draw 1.',
    cost: { energy: {}, discardHand },
    effects: [{ kind: 'draw', amount: 1 }],
  },
})

const withFlipPending = (
  state: GameState,
  revealedHpCard: GameCard,
): GameState => ({
  ...state,
  pendingBattle: {
    ...state.pendingBattle!,
    stage: 'flip',
    damagePlayerId: 'player-one',
    revealedHpCard,
  },
})

describe('handleAiPendingBattle：FLIP 發動判斷', () => {
  // FLIP 的棄牌代價是傷害已經發生後才付，不像陷阱有「提前暴露資訊」的
  // 隱性成本；曾經試過比照陷阱用 EFFECT_VALUE_MAP 門檻擋下低效果價值／
  // 高棄牌代價的 FLIP，300 局 benchmark 顯示連 Lv.4 vs Lv.1 都從 100%
  // 掉到 95%——代表「有效果就發動」才是符合設計的正確預設，這裡改成
  // 驗證這個行為在 Lv.2／Lv.3 都成立，不再引入未經校準的門檻。
  it('不論等級、棄牌代價多高，只要條件成立就發動 FLIP', () => {
    for (const level of [2, 3] as const) {
      let state = declareAttack(createBattleState())
      state.players['player-one'].hand = [
        item('extra-1'),
        item('extra-2'),
        item('extra-3'),
      ]
      state = withFlipPending(state, flipCard(3))

      const decision = handleAiPendingBattle(state, 'player-one', level)

      expect(decision?.action).toBe('resolve-flip')
      expect(decision?.description).toContain('發動')
      expect(decision?.description).not.toContain('略過')
    }
  })

  const valuableCookie: GameCard = {
    id: 'ace-cookie',
    instanceId: 'ace-cookie',
    name: 'Ace Cookie',
    type: 'cookie',
    level: 4,
    hp: 5,
    attack: 5,
    attackCost: 1,
  }
  const richFlipCard: GameCard = {
    ...cookie('flip-source'),
    officialType: 'flip',
    flip: {
      text: 'Draw 1. Draw 1.',
      cost: { energy: {}, discardHand: 1 },
      effects: [
        { kind: 'draw', amount: 1 },
        { kind: 'draw', amount: 1 },
      ],
    },
  }
  const buildDiscardPriorityState = (): GameState => {
    const state = declareAttack(createBattleState())
    // 把高價值餅乾放在手牌最前面——舊邏輯（照手牌順序砍前 N 張）會優先丟它。
    state.players['player-one'].hand = [valuableCookie, item('junk-item')]
    // 補牌庫，避免兩次 draw 把牌庫抽空觸發牌庫耗盡判定（跟這裡要測的
    // 棄牌選擇邏輯無關）。
    state.players['player-one'].deck = [
      item('deck-pad-1'),
      item('deck-pad-2'),
      item('deck-pad-3'),
      item('deck-pad-4'),
    ]
    return withFlipPending(state, richFlipCard)
  }

  it('Lv.3+：棄牌優先選手牌裡「捨得丟」的卡，不是固定丟前 N 張', () => {
    const decision = handleAiPendingBattle(
      buildDiscardPriorityState(),
      'player-one',
      3,
    )

    expect(decision?.action).toBe('resolve-flip')
    expect(decision?.description).toContain('發動')
    // 只需要棄 1 張：應該丟雜項道具，留下高價值餅乾。
    const remainingHand = decision!.state.players['player-one'].hand
    expect(remainingHand.some((c) => c.instanceId === 'ace-cookie')).toBe(true)
    expect(remainingHand.some((c) => c.instanceId === 'junk-item')).toBe(false)
  })

  it('Lv.2（未啟用 R7）：維持照手牌順序砍前 N 張的舊行為', () => {
    const decision = handleAiPendingBattle(
      buildDiscardPriorityState(),
      'player-one',
      2,
    )

    expect(decision?.action).toBe('resolve-flip')
    // 手牌順序是 [ace-cookie, junk-item]，未啟用 R7 應該丟第一張。
    const remainingHand = decision!.state.players['player-one'].hand
    expect(remainingHand.some((c) => c.instanceId === 'ace-cookie')).toBe(false)
    expect(remainingHand.some((c) => c.instanceId === 'junk-item')).toBe(true)
  })
})

describe('handleAiPendingBattle：FLIP 多目標安全性', () => {
  it('當不同子效果沒有共同 target id 時保守略過，不送出非法 command', () => {
    const state = withFlipPending(
      declareAttack(createBattleState()),
      {
        ...cookie('multi-target-flip'),
        officialType: 'flip',
        flip: {
          text: 'Deal damage to an opponent and gain HP on your Cookie.',
          cost: { energy: {}, discardHand: 0 },
          effects: [
            {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 1, max: 1 },
            },
            {
              kind: 'gain-hp',
              amount: 1,
              target: { side: 'self', min: 1, max: 1 },
            },
          ],
        },
      },
    )

    const decision = handleAiPendingBattle(state, 'player-one', 3)

    expect(decision?.action).toBe('resolve-flip')
    expect(decision?.description).toContain('略過')
    expect(decision?.reason?.pendingStrategy).toMatchObject({
      kind: 'flip',
      usedUniversalSelection: true,
      publicViewOnly: true,
    })
  })
})
