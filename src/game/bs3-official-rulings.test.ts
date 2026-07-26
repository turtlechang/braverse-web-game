import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { beginAttack, playTrap } from './battle'
import { canActivateCookieSkill } from './skills'
import type { CookieCard, GameCard, GameState } from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

/**
 * 官方 Q&A：再登場步驟中,攻擊方先放置再登場的餅乾,再換防禦方放置。
 * BS3-028 莫札瑞拉起司餅乾（登場）：<🟡><棄 1 張手牌> 若對手休息區 LV 總和
 * ≤6，從對手棄牌區選最多 1 個 LV.1 餅乾放進對手休息區。
 * BS3-113 黑糖餅乾（登場）：<🟣> 若自己棄牌區有 15 張以上 🟣 牌，整批洗回
 * 牌庫，然後對對手全體造成 2 傷害。
 * 官方裁定：攻擊方的 BS3-028 若成立，會讓防禦方棄牌區少 1 張，防禦方的
 * BS3-113 隨後判定棄牌區只剩 14 張，無法發動。
 */
describe('official ruling: replacement order lets BS3-028 disarm BS3-113', () => {
  const bs3028 = (instanceId: string): CookieCard => ({
    ...cookie(instanceId, 2, 4),
    id: 'BS3-028',
    level: 3,
    energyColor: 'yellow',
    skill: {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { yellow: 1 }, discardHand: 1 },
      text: 'BS3-028',
      effects: [
        {
          kind: 'opponent-trash-to-break',
          max: 1,
          exactLevel: 1,
          condition: { kind: 'opponent-break-level-at-most', level: 6 },
        },
      ],
    },
  })

  const bs3113 = (instanceId: string): CookieCard => ({
    ...cookie(instanceId, 2, 5),
    id: 'BS3-113',
    level: 3,
    energyColor: 'purple',
    skill: {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { purple: 1 }, discardHand: 0 },
      text: 'BS3-113',
      effects: [
        {
          kind: 'trash-to-deck-all',
          condition: {
            kind: 'trash-color-count-at-least',
            color: 'purple',
            count: 15,
          },
          thenEffects: [{ kind: 'damage-all', amount: 2, side: 'opponent' }],
        },
      ],
    },
  })

  /**
   * player-two（攻擊方／回合玩家）與 player-one（防禦方）雙方戰鬥區都清空，
   * 等待各自從手牌再登場；防禦方休息區 LV 總和為 5（符合 BS3-028 條件的
   * ≤6），棄牌區恰好 15 張紫卡，其中 1 張是 LV.1 Cookie。
   */
  const createReplacementState = (): GameState => {
    const base = createBattleState()
    const defenderTrash: GameCard[] = [
      { ...cookie('trash-lv1-purple', 1, 1), level: 1, energyColor: 'purple' },
      ...Array.from({ length: 14 }, (_, index) =>
        item(`trash-purple-${index}`, 'purple'),
      ),
    ]

    return {
      ...base,
      activePlayerId: 'player-two',
      departedCookieCounts: { 'player-one': 1, 'player-two': 1 },
      pendingReplacement: {
        tasks: [
          { playerId: 'player-two', remaining: 1 },
          { playerId: 'player-one', remaining: 1 },
        ],
      },
      players: {
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          hand: [bs3028('gcc-028'), item('p2-discard-fodder')],
          supportArea: [{ card: item('p2-yellow', 'yellow'), rested: false }],
          // 留超過 BS3-028 hp(4) 的牌庫，避免放置時剛好耗盡牌庫觸發
          // Refresh／落敗判定，干擾這個測試要驗證的再登場順序。
          deck: Array.from({ length: 8 }, (_, index) => item(`p2-deck-hp-${index}`)),
        },
        'player-one': {
          ...base.players['player-one'],
          battleArea: [],
          hand: [bs3113('gcc-113')],
          supportArea: [{ card: item('p1-purple', 'purple'), rested: false }],
          breakArea: [{ ...cookie('break-lv5', 1, 1), level: 5 }],
          discardPile: defenderTrash,
          deck: Array.from({ length: 6 }, (_, index) => item(`p1-deck-hp-${index}`)),
        },
      },
    }
  }

  it('lets the attacker replace first per buildReplacementTasks ordering', () => {
    const state = createReplacementState()
    // getCurrentReplacementTask 的邏輯藏在 replace-cookie 指令內；直接嘗試
    // 讓防禦方先放置應該被拒絕，因為目前排到的是攻擊方（活躍玩家）的任務。
    expect(() =>
      applyGameCommand(state, {
        kind: 'replace-cookie',
        playerId: 'player-one',
        instanceId: 'gcc-113',
      }),
    ).toThrowError()
  })

  it('BS3-113 can activate before BS3-028 removes a purple trash card', () => {
    // 基準對照：防禦方棄牌區還是 15 張紫卡時，BS3-113 本該能發動。
    const state = createReplacementState()
    expect(
      canActivateCookieSkill(state, 'player-one', 'gcc-113', 'on-play'),
    ).toBe(false) // battleArea 還沒放置 gcc-113，來源不存在，先確認前提

    const withGcc113InBattle: GameState = {
      ...state,
      pendingOnPlay: { playerId: 'player-one', sourceInstanceId: 'gcc-113' },
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              card: bs3113('gcc-113'),
              hpCards: [item('hp-a')],
              rested: false,
              battleEntryId: 'gcc-113:battle:1',
            },
          ],
        },
      },
    }
    expect(
      canActivateCookieSkill(withGcc113InBattle, 'player-one', 'gcc-113', 'on-play'),
    ).toBe(true)
  })

  it('BS3-028 resolving first drops the defender to 14 purple trash cards, disarming BS3-113', () => {
    const state = createReplacementState()

    const attackerPlaced = applyGameCommand(state, {
      kind: 'replace-cookie',
      playerId: 'player-two',
      instanceId: 'gcc-028',
    })
    expect(attackerPlaced.pendingOnPlay).toEqual({
      playerId: 'player-two',
      sourceInstanceId: 'gcc-028',
    })

    // 防禦方在攻擊方的 OnPlay 結算完成前不能放置自己的再登場餅乾。
    expect(() =>
      applyGameCommand(attackerPlaced, {
        kind: 'replace-cookie',
        playerId: 'player-one',
        instanceId: 'gcc-113',
      }),
    ).toThrowError()

    const bs3028Resolved = applyGameCommand(attackerPlaced, {
      kind: 'activate-skill',
      playerId: 'player-two',
      sourceInstanceId: 'gcc-028',
      trigger: 'on-play',
      paymentIds: ['p2-yellow'],
      discardHandIds: ['p2-discard-fodder'],
      effectTargets: [['trash-lv1-purple']],
    })

    expect(bs3028Resolved.pendingOnPlay).toBeNull()
    const defenderAfterBs3028 = bs3028Resolved.players['player-one']
    expect(
      defenderAfterBs3028.discardPile.filter((card) => card.energyColor === 'purple'),
    ).toHaveLength(14)
    expect(
      defenderAfterBs3028.breakArea.map((card) => card.instanceId),
    ).toContain('trash-lv1-purple')

    const defenderPlaced = applyGameCommand(bs3028Resolved, {
      kind: 'replace-cookie',
      playerId: 'player-one',
      instanceId: 'gcc-113',
    })

    // 放置後一律先設 pendingOnPlay（規則引擎不預判效果是否可用），但官方
    // 裁定的關鍵是：棄牌區只剩 14 張紫卡，BS3-113 的登場技能已無法發動。
    expect(defenderPlaced.pendingOnPlay).toEqual({
      playerId: 'player-one',
      sourceInstanceId: 'gcc-113',
    })
    expect(
      canActivateCookieSkill(defenderPlaced, 'player-one', 'gcc-113', 'on-play'),
    ).toBe(false)

    const skipped = applyGameCommand(defenderPlaced, {
      kind: 'skip-on-play',
      playerId: 'player-one',
      sourceInstanceId: 'gcc-113',
    })
    expect(skipped.pendingOnPlay).toBeNull()
    // 沒有洗牌回牌庫，也沒有對攻擊方造成傷害。
    expect(skipped.players['player-one'].discardPile.length).toBe(14)
    expect(
      skipped.players['player-two'].battleArea[0]?.hpCards.length,
    ).toBe(4)
  })
})

/**
 * 官方 Q&A：BS3-100 黑可可餅乾的攻擊附加效果（從對手餅乾 HP 卡最上方抽 1 張
 * 放入棄牌區）不能在 ST3-020 聖光屏障（本次戰鬥 HP 不會變 0）保護生效時，
 * 把目標最後 1 張 HP 卡送進棄牌區——因為戰鬥還沒結束，保護仍持續中。
 */
describe('official ruling: ST3-020 protects against BS3-100 hp-to-trash, not just damage', () => {
  const bs3100 = (instanceId: string): CookieCard => ({
    ...cookie(instanceId, 3, 5),
    id: 'BS3-100',
    level: 3,
    energyColor: 'purple',
    // 攻擊代價與傷害量與這條裁定無關，簡化成 1 點以精簡測試設置。
    attackCost: 1,
    attackEnergyCost: { purple: 1 },
    attackEffects: [
      { kind: 'hp-to-trash', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
    ],
  })

  const st3020 = (instanceId: string): GameCard => ({
    id: 'ST3-020',
    instanceId,
    name: 'Divine Light Crystal',
    type: 'trap',
    energyColor: 'green',
    trap: {
      text: 'ST3-020',
      cost: { energy: { green: 2 }, discardHand: 0 },
      effects: [
        { kind: 'prevent-knockout', target: { side: 'self', min: 0, max: 1 } },
      ],
    },
  })

  const createDuelState = (): GameState => {
    const base = createBattleState()
    return {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              card: bs3100('attacker-bs3100'),
              hpCards: [item('atk-hp')],
              rested: false,
              battleEntryId: 'attacker-bs3100:battle:1',
            },
          ],
          supportArea: [{ card: item('p2-support', 'purple'), rested: false }],
        },
        'player-one': {
          ...base.players['player-one'],
          hand: [st3020('st3020-trap')],
          supportArea: [
            { card: item('p1-green', 'green'), rested: false },
            { card: item('p1-green-2', 'green'), rested: false },
          ],
          // 只剩最後 1 張 HP 卡，是本次裁定要保護的目標。
          battleArea: [
            {
              card: base.players['player-one'].battleArea[0].card,
              hpCards: [item('defender-last-hp')],
              rested: false,
              battleEntryId: 'defender:battle:1',
            },
          ],
        },
      },
    }
  }

  it('keeps the last HP card through both the attack damage and the attack-then effect', () => {
    let state = createDuelState()
    state = beginAttack(state, 'attacker-bs3100', 'defender', ['p2-support'])
    state = playTrap(state, 'player-one', {
      trapInstanceId: 'st3020-trap',
      paymentIds: ['p1-green', 'p1-green-2'],
      targetIds: ['defender'],
    })
    expect(state.pendingBattle?.preventKnockoutTargetIds).toContain('defender')

    while (state.pendingBattle?.stage === 'damage') {
      state = applyGameCommand(state, {
        kind: 'resolve-next-damage',
        // resolve-next-damage 由承受傷害的一方（防禦方）發起。
        playerId: 'player-one',
      })
    }

    // 傷害步驟結束，保護已經擋下一般傷害，最後 1 張 HP 卡還在。
    const afterDamage = state.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === 'defender',
    )
    expect(afterDamage?.hpCards).toHaveLength(1)
    expect(state.pendingBattle?.stage).toBe('attack-effect')

    state = applyGameCommand(state, {
      kind: 'resolve-attack-effect',
      playerId: 'player-two',
      targetIds: ['defender'],
    })

    const player = state.players['player-one']
    const survivor = player.battleArea.find(
      (entry) => entry.card.instanceId === 'defender',
    )
    // 核心斷言：hp-to-trash 攻擊後續效果也不能把最後 1 張 HP 卡送進棄牌區。
    expect(survivor).toBeTruthy()
    expect(survivor?.hpCards).toHaveLength(1)
    expect(
      player.discardPile.some((card) => card.instanceId === 'defender-last-hp'),
    ).toBe(false)
  })

  it('still removes the HP card normally once the Cookie is not protected', () => {
    const base = createBattleState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            {
              card: bs3100('attacker-bs3100'),
              hpCards: [item('atk-hp')],
              rested: false,
              battleEntryId: 'attacker-bs3100:battle:1',
            },
          ],
        },
        // 只剩最後 1 張 HP 卡，才會讓 hp-to-trash amount:1 造成昏厥。
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              card: base.players['player-one'].battleArea[0].card,
              hpCards: [item('defender-last-hp')],
              rested: false,
              battleEntryId: 'defender:battle:1',
            },
          ],
        },
      },
    }
    const next = applyGameCommand(
      {
        ...state,
        pendingBattle: {
          attackerPlayerId: 'player-two',
          defenderPlayerId: 'player-one',
          attackerInstanceId: 'attacker-bs3100',
          targetInstanceId: 'defender',
          declaredDamage: 0,
          remainingDamage: 0,
          stage: 'attack-effect',
          trapUsed: false,
          revealedHpCard: null,
          preventKnockoutTargetIds: [],
          faintedColors: [],
          attackEffects: bs3100('attacker-bs3100').attackEffects!,
          attackEffectIndex: 0,
        },
      },
      {
        kind: 'resolve-attack-effect',
        playerId: 'player-two',
        targetIds: ['defender'],
      },
    )

    const player = next.players['player-one']
    expect(
      player.battleArea.some((entry) => entry.card.instanceId === 'defender'),
    ).toBe(false)
    expect(player.breakArea.map((card) => card.instanceId)).toContain('defender')
  })
})
