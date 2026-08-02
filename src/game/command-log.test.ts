import { describe, expect, it } from 'vitest'
import { appendCommandLogEntry, type CommandLogEntry, type GameState } from '.'
import {
  describeCommand,
  describeCommandSteps,
  resolveLogCard,
  resolveLogCategory,
} from './command-log'
import { createBattleState } from './test-helpers/battle-helpers'

const withCommandLog = (
  state: GameState,
  commandLog: CommandLogEntry[],
): GameState => ({ ...state, commandLog })

describe('appendCommandLogEntry groupId', () => {
  it('continues the previous group when a blocking decision was already open', () => {
    const base = createBattleState()
    const previous: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        stage: 'trap',
        declaredDamage: 1,
        remainingDamage: 1,
        trapUsed: false,
        preventKnockoutTargetIds: [],
        attackEffects: [],
        attackEffectIndex: 0,
      } as unknown as GameState['pendingBattle'],
      commandLog: [
        {
          id: 1,
          turnNumber: 1,
          phase: 'main',
          playerId: 'player-two',
          commandKind: 'declare-attack',
          payload: {},
          groupId: 1,
        },
      ],
    }
    const next = withCommandLog(previous, previous.commandLog!)

    const result = appendCommandLogEntry(previous, next, {
      kind: 'skip-trap',
      playerId: 'player-one',
    })

    const appended = result.commandLog!.at(-1)!
    expect(appended.groupId).toBe(1)
  })

  it('starts a new group when there was no blocking decision before this command', () => {
    const base = createBattleState()
    const previous: GameState = {
      ...base,
      pendingBattle: null,
      commandLog: [
        {
          id: 1,
          turnNumber: 1,
          phase: 'main',
          playerId: 'player-one',
          commandKind: 'place-support',
          payload: {},
          groupId: 1,
        },
      ],
    }
    const next = withCommandLog(previous, previous.commandLog!)

    const result = appendCommandLogEntry(previous, next, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: [],
    })

    const appended = result.commandLog!.at(-1)!
    expect(appended.groupId).toBe(2)
    expect(appended.groupId).toBe(appended.id)
  })

  it('starts a new group when the log is empty even if a blocking decision happens to already be open', () => {
    const base = createBattleState()
    const previous: GameState = { ...base, pendingBattle: null, commandLog: [] }
    const next = withCommandLog(previous, [])

    const result = appendCommandLogEntry(previous, next, {
      kind: 'skip-trap',
      playerId: 'player-one',
    })

    const appended = result.commandLog!.at(-1)!
    expect(appended.groupId).toBe(appended.id)
  })
})

describe('resolveLogCategory', () => {
  it('tags common commandKinds', () => {
    const state = createBattleState()
    expect(
      resolveLogCategory(state, state, {
        kind: 'play-trap',
        playerId: 'player-one',
        trapInstanceId: 'x',
        paymentIds: [],
        targetIds: [],
      }),
    ).toBe('activate')
    expect(
      resolveLogCategory(state, state, {
        kind: 'resolve-next-damage',
        playerId: 'player-one',
      }),
    ).toBe('damage')
    expect(
      resolveLogCategory(state, state, {
        kind: 'resolve-flip',
        playerId: 'player-one',
        activate: true,
      }),
    ).toBe('flip')
  })

  it('overrides advance-phase to draw when the hand grew', () => {
    const before = createBattleState()
    const after: GameState = {
      ...before,
      players: {
        ...before.players,
        'player-one': {
          ...before.players['player-one'],
          hand: [...before.players['player-one'].hand, { id: 'x', instanceId: 'x', name: 'x', type: 'item' }],
        },
      },
    }

    expect(
      resolveLogCategory(before, after, { kind: 'advance-phase', playerId: 'player-one' }),
    ).toBe('draw')
  })

  it('keeps advance-phase as phase when nothing was drawn', () => {
    const state = createBattleState()
    expect(
      resolveLogCategory(state, state, { kind: 'advance-phase', playerId: 'player-one' }),
    ).toBe('phase')
  })
})

describe('appendCommandLogEntry breakLevel', () => {
  it('records both players current break level', () => {
    const base = createBattleState()
    const next: GameState = {
      ...base,
      commandLog: [],
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [
            { id: 'b1', instanceId: 'b1', name: 'b1', type: 'cookie', level: 2, hp: 1, attack: 1, attackCost: 1 },
          ],
        },
      },
    }

    const result = appendCommandLogEntry(base, next, {
      kind: 'skip-trap',
      playerId: 'player-one',
    })

    const appended = result.commandLog!.at(-1)!
    expect(appended.breakLevel).toEqual({ 'player-one': 2, 'player-two': 0 })
  })
})

describe('describeCommandSteps', () => {
  it('breaks a play-trap command into payment + target steps', () => {
    const state = createBattleState()
    const steps = describeCommandSteps(state, state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: 'p1-hand-a',
      paymentIds: ['p1-support-a', 'p1-support-b'],
      targetIds: ['attacker'],
    })

    expect(steps?.map((step) => step.text)).toEqual([
      '支付能量（橫置）：p1-support-a、p1-support-b',
      '選擇目標：attacker',
    ])
    // 每個步驟要附上實際用到的卡片，UI 才能顯示縮圖，不是只有文字。
    expect(steps?.[0].cards?.map((card) => card.instanceId)).toEqual([
      'p1-support-a',
      'p1-support-b',
    ])
    expect(steps?.[1].cards?.map((card) => card.instanceId)).toEqual(['attacker'])
  })

  it('breaks an activate-skill command into payment + effect target + choose-one steps', () => {
    const state = createBattleState()
    const steps = describeCommandSteps(state, state, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'defender',
      trigger: 'activate',
      paymentIds: ['p1-support-a'],
      effectTargets: [['attacker']],
      chooseOneModes: [0],
    })

    expect(steps?.map((step) => step.text)).toEqual([
      '支付能量（橫置）：p1-support-a',
      '第 1 個效果目標：attacker',
      '第 1 個「選擇一項」效果：選了第 1 個選項',
    ])
  })

  it('summarizes an auto-resolved attack with the damage dealt', () => {
    const base = createBattleState()
    // defender 有 3 張 HP 卡，扣 1 張後剩 2 張——非致命傷害，驗證「造成 N 點傷害」
    // 這條分支（跟致命的「擊倒」分支分開驗證）。
    const next: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: base.players['player-one'].battleArea.map((cookieInBattle) =>
            cookieInBattle.card.instanceId === 'defender'
              ? { ...cookieInBattle, hpCards: cookieInBattle.hpCards.slice(0, -1) }
              : cookieInBattle,
          ),
        },
      },
    }

    const steps = describeCommandSteps(base, next, {
      kind: 'attack',
      playerId: 'player-two',
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: [],
    })

    expect(steps?.map((step) => step.text)).toEqual([
      '宣告攻擊：「attacker」→「defender」',
      '自動結算戰鬥，造成 1 點傷害',
    ])
    expect(steps?.[0].cards?.map((card) => card.instanceId)).toEqual([
      'attacker',
      'defender',
    ])
  })

  it('reports a knockout when the target is fully depleted', () => {
    const base = createBattleState()
    const next: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: base.players['player-two'].battleArea.map((cookieInBattle) =>
            cookieInBattle.card.instanceId === 'attacker'
              ? { ...cookieInBattle, hpCards: [] }
              : cookieInBattle,
          ),
        },
      },
    }

    const steps = describeCommandSteps(base, next, {
      kind: 'attack',
      playerId: 'player-one',
      attackerInstanceId: 'defender',
      targetInstanceId: 'attacker',
      supportPaymentIds: [],
    })

    expect(steps?.map((step) => step.text)).toEqual([
      '宣告攻擊：「defender」→「attacker」',
      '自動結算戰鬥，擊倒「attacker」',
    ])
  })

  it('returns undefined for kinds that do not need step synthesis', () => {
    const state = createBattleState()
    expect(
      describeCommandSteps(state, state, { kind: 'skip-trap', playerId: 'player-one' }),
    ).toBeUndefined()
  })

  it('names every extra-cost field with the actual cards used, not just a count', () => {
    const state = createBattleState()
    const steps = describeCommandSteps(state, state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: 'p1-hand-a',
      paymentIds: ['p1-support-a'],
      targetIds: [],
      discardHandIds: ['p1-hand-a'],
    })

    expect(steps?.map((step) => step.text)).toEqual([
      '支付能量（橫置）：p1-support-a',
      '額外代價：棄置手牌：p1-hand-a',
    ])
  })
})

describe('resolveRevealedDamageCard (resolve-next-damage / resolve-flip)', () => {
  it('names the flipped HP card even when the battle finishes in the same command (card goes straight to discard)', () => {
    // 沒有 FLIP 能力的卡翻開後立刻進棄牌區；如果這次結算剛好讓 remainingDamage
    // 歸零、戰鬥整個結束，pendingBattle 會在同一個指令裡被清空——不能只看
    // next.pendingBattle.revealedHpCard，要看棄牌區這次多了哪張卡。
    const base = createBattleState()
    const flippedHpCard = base.players['player-one'].battleArea[0].hpCards[0]
    const previous: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'attacker',
        targetInstanceId: 'defender',
        damagePlayerId: 'player-one',
        stage: 'damage',
        declaredDamage: 1,
        remainingDamage: 1,
        trapUsed: false,
        preventKnockoutTargetIds: [],
        attackEffects: [],
        attackEffectIndex: 0,
      } as unknown as GameState['pendingBattle'],
    }
    const next: GameState = {
      ...previous,
      pendingBattle: null,
      players: {
        ...previous.players,
        'player-one': {
          ...previous.players['player-one'],
          battleArea: previous.players['player-one'].battleArea.map((cookie) =>
            cookie.card.instanceId === 'defender'
              ? { ...cookie, hpCards: cookie.hpCards.slice(0, -1) }
              : cookie,
          ),
          discardPile: [...previous.players['player-one'].discardPile, flippedHpCard],
        },
      },
    }
    const command = { kind: 'resolve-next-damage' as const, playerId: 'player-one' as const }

    expect(describeCommand(previous, next, command)).toBe(
      `防守玩家 翻開了 HP 卡「${flippedHpCard.name}」`,
    )
    expect(resolveLogCard(previous, next, command)).toEqual(flippedHpCard)
  })

  it('falls back to the generic summary when this call did not reveal a new card', () => {
    const base = createBattleState()
    const command = { kind: 'resolve-next-damage' as const, playerId: 'player-one' as const }

    expect(describeCommand(base, base, command)).toBe('防守玩家 結算了下一段傷害')
    expect(resolveLogCard(base, base, command)).toBeUndefined()
  })
})
