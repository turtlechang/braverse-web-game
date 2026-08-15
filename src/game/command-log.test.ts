import { describe, expect, it } from 'vitest'
import { appendCommandLogEntry, type CommandLogEntry, type GameState } from '.'
import {
  describeCommand,
  describeCommandSteps,
  resolveLogCard,
  resolveLogCategory,
} from './command-log'
import { cookie, createBattleState } from './test-helpers/battle-helpers'

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

  it('shows the actual HP card and its type for a begin-activate-skill cost', () => {
    const base = createBattleState()
    const source = base.players['player-one'].battleArea.find(
      (cookie) => cookie.card.instanceId === 'defender',
    )!
    const hpCard = source.hpCards.at(-1)!
    const previous: GameState = {
      ...base,
      costRecord: undefined,
    }
    const next: GameState = {
      ...previous,
      costRecord: {
        hpTrashCookieInstanceId: 'defender',
        hpTrashTopCardInstanceId: hpCard.instanceId,
        hpTrashTopCardType: 'item',
      },
      players: {
        ...previous.players,
        'player-one': {
          ...previous.players['player-one'],
          battleArea: previous.players['player-one'].battleArea.map((cookie) =>
            cookie.card.instanceId === 'defender'
              ? { ...cookie, hpCards: cookie.hpCards.slice(0, -1) }
              : cookie,
          ),
          discardPile: [...previous.players['player-one'].discardPile, hpCard],
        },
      },
    }
    const command = {
      kind: 'begin-activate-skill' as const,
      playerId: 'player-one' as const,
      sourceInstanceId: 'defender',
      trigger: 'activate' as const,
      paymentIds: [],
      hpToTrashTargetIds: ['defender'],
    }

    const steps = describeCommandSteps(previous, next, command)

    expect(steps?.map((step) => step.text)).toContain(
      `HP 費用：從「${source.card.name}」丟棄「${hpCard.name}」（物品）`,
    )
    expect(steps?.find((step) => step.text.includes('HP 費用'))?.cards).toEqual([
      hpCard,
    ])
    expect(describeCommand(previous, next, command)).toContain(
      `（HP 費用：從「${source.card.name}」丟棄「${hpCard.name}」（物品））`,
    )
  })

  it('records the actual battle Cookie returned for a skill cost', () => {
    const base = createBattleState()
    const returned = cookie('returned-blue-lv1')
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            {
              card: returned,
              hpCards: [],
              rested: false,
              battleEntryId: 'returned-blue-lv1:battle:3',
            },
          ],
        },
      },
    }
    const next: GameState = {
      ...previous,
      players: {
        ...previous.players,
        'player-one': {
          ...previous.players['player-one'],
          battleArea: previous.players['player-one'].battleArea.filter(
            (cookieInBattle) => cookieInBattle.card.instanceId !== returned.instanceId,
          ),
          hand: [...previous.players['player-one'].hand, returned],
        },
      },
    }
    const command = {
      kind: 'begin-activate-skill' as const,
      playerId: 'player-one' as const,
      sourceInstanceId: 'defender',
      trigger: 'on-play' as const,
      paymentIds: [],
      battleToHandIds: [returned.instanceId],
    }

    const steps = describeCommandSteps(previous, next, command)
    const returnedStep = steps?.find((step) =>
      step.text.includes('返回手牌'),
    )

    expect(returnedStep?.cards).toEqual([returned])
    expect(describeCommand(previous, next, command)).toContain(
      `技能代價：將戰鬥區餅乾返回手牌：${returned.name}`,
    )
  })

  it('explains why BS4-077 can pay its deck-bottom cost through Timekeeper', () => {
    const base = createBattleState()
    const sorbetShark = {
      ...cookie('sorbet-shark', 1, 1),
      id: 'BS4-077',
      name: 'Sorbet Shark Cookie',
      energyColor: 'blue' as const,
      skill: {
        trigger: 'activate' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { blue: 1 }, selfToDeckBottom: true },
        text: 'Place this Cookie on the bottom of your deck.',
        effects: [],
      },
    }
    const timekeeper = {
      ...cookie('timekeeper', 2, 4),
      id: 'BS6-010',
      name: 'Timekeeper Cookie',
      energyColor: 'red' as const,
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'Opponents cannot move Cookies out of battle by effects.',
        effects: [{ kind: 'prevent-opponent-battle-movement' as const }],
      },
    }
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: sorbetShark, hpCards: [], rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [{ card: timekeeper, hpCards: [], rested: false }],
        },
      },
    }
    const next: GameState = {
      ...previous,
      players: {
        ...previous.players,
        'player-one': {
          ...previous.players['player-one'],
          battleArea: [],
          deck: [...previous.players['player-one'].deck, sorbetShark],
        },
      },
    }
    const command = {
      kind: 'begin-activate-skill' as const,
      playerId: 'player-one' as const,
      sourceInstanceId: sorbetShark.instanceId,
      trigger: 'activate' as const,
      paymentIds: ['p1-support-a'],
    }

    const explanation = `技能代價：將「${sorbetShark.name}」放到牌庫底；「${timekeeper.name}」只阻止效果造成的移動，這是發動代價，仍可支付`
    const steps = describeCommandSteps(previous, next, command)
    const costStep = steps?.find((step) => step.text === explanation)

    expect(costStep?.cards).toEqual([sorbetShark, timekeeper])
    expect(describeCommand(previous, next, command)).toContain(explanation)
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

  it('records the BS4-024 forced-target reason and source card in an attack log', () => {
    const base = createBattleState()
    const defenderEntry = base.players['player-one'].battleArea[0]
    const kumiho = {
      ...defenderEntry.card,
      id: 'BS4-024',
      instanceId: 'kumiho',
      name: 'Kumiho Cookie',
      level: 1,
      energyColor: 'yellow' as const,
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: "If there is a Yellow LV.3 Cookie in your battle area, your opponent's Cookies can only attack this Cookie.",
        effects: [
          {
            kind: 'redirect-attack' as const,
            target: { side: 'self' as const, min: 1, max: 1, sourceOnly: true },
            condition: {
              kind: 'battle-area-has-color' as const,
              side: 'self' as const,
              color: 'yellow' as const,
              level: 3,
            },
          },
        ],
      },
    }
    const yellowLevelThree = {
      ...defenderEntry.card,
      id: 'yellow-lv3',
      instanceId: 'yellow-lv3',
      name: 'Yellow Level 3 Cookie',
      level: 3,
      energyColor: 'yellow' as const,
    }
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { ...defenderEntry, card: kumiho },
            { ...defenderEntry, card: yellowLevelThree, battleEntryId: 'yellow-lv3:battle:2' },
          ],
        },
      },
    }
    const command = {
      kind: 'declare-attack' as const,
      playerId: 'player-two' as const,
      attackerInstanceId: 'attacker',
      targetInstanceId: 'kumiho',
      supportPaymentIds: ['p2-support'],
    }

    expect(describeCommand(previous, previous, command)).toContain(
      '目標限制：因「Kumiho Cookie」的被動效果（場上有黃色 LV.3 餅乾），只能攻擊「Kumiho Cookie」',
    )
    const steps = describeCommandSteps(previous, previous, command)
    expect(steps?.[1].text).toContain('只能攻擊「Kumiho Cookie」')
    expect(steps?.[1].cards?.map((card) => card.id)).toEqual(['BS4-024'])
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

describe('effect resolution log outcome', () => {
  it('reports the actual damage dealt by a resolved ability instead of only the target choice', () => {
    const base = createBattleState()
    const previous: GameState = {
      ...base,
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'defender',
        sourceKind: 'skill',
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
        effectIndex: 0,
      },
    }
    const next: GameState = {
      ...previous,
      pendingAbilityEffect: undefined,
      players: {
        ...previous.players,
        'player-two': {
          ...previous.players['player-two'],
          battleArea: previous.players['player-two'].battleArea.map((cookie) =>
            cookie.card.instanceId === 'attacker'
              ? { ...cookie, hpCards: cookie.hpCards.slice(0, -1) }
              : cookie,
          ),
        },
      },
    }

    expect(
      describeCommand(previous, next, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      }),
    ).toContain('「attacker」受到 1 點傷害')
  })

  it('reports when a damage effect resolves without dealing damage', () => {
    const base = createBattleState()
    const previous: GameState = {
      ...base,
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'defender',
        sourceKind: 'skill',
        effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
        effectIndex: 0,
      },
    }

    expect(
      describeCommand(previous, { ...previous, pendingAbilityEffect: undefined }, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      }),
    ).toContain('未造成傷害')
  })

  it('records the Cookie moved to the trash by BS2-058 with its card image data', () => {
    const base = createBattleState()
    const windArcher = {
      ...cookie('wind-archer', 4, 5),
      id: 'BS2-058',
      name: 'Wind Archer Cookie',
      level: 3,
      energyColor: 'purple' as const,
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { purple: 1 },
        text: 'Place up to 1 of your opponent\'s LV.3 Cookies into the trash.',
        effects: [
          { kind: 'opponent-battle-to-trash' as const, minLevel: 3, maxLevel: 3 },
        ],
      },
    }
    const target = cookie('target-lv3', 2, 4)
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ ...base.players['player-one'].battleArea[0], card: windArcher }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [{ ...base.players['player-two'].battleArea[0], card: target }],
        },
      },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: windArcher.instanceId,
        sourceCardName: windArcher.name,
        sourceKind: 'skill',
        effects: [
          { kind: 'opponent-battle-to-trash', minLevel: 3, maxLevel: 3 },
        ],
        effectIndex: 0,
      },
    }
    const next: GameState = {
      ...previous,
      pendingAbilityEffect: undefined,
      players: {
        ...previous.players,
        'player-two': {
          ...previous.players['player-two'],
          battleArea: [],
          discardPile: [...previous.players['player-two'].discardPile, target],
        },
      },
    }
    const command = {
      kind: 'resolve-ability-effect' as const,
      playerId: 'player-one' as const,
      targetIds: [target.instanceId],
    }

    expect(describeCommand(previous, next, command)).toContain(
      `將「${target.name}」放入棄牌區`,
    )
    const step = describeCommandSteps(previous, next, command)?.[0]
    expect(step?.text).toBe(`效果結算：將「${target.name}」放入棄牌區`)
    expect(step?.cards).toEqual([target])
  })

  it('records the card effect that blocks BS2-058 from moving an opponent Cookie', () => {
    const base = createBattleState()
    const windArcher = {
      ...cookie('wind-archer', 4, 5),
      id: 'BS2-058',
      name: 'Wind Archer Cookie',
      level: 3,
      energyColor: 'purple' as const,
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { purple: 1 },
        text: 'Place up to 1 of your opponent\'s LV.3 Cookies into the trash.',
        effects: [
          { kind: 'opponent-battle-to-trash' as const, minLevel: 3, maxLevel: 3 },
        ],
      },
    }
    const timekeeper = {
      ...cookie('timekeeper', 1, 4),
      id: 'BS6-010',
      name: 'Timekeeper Cookie',
      level: 3,
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'Opponents cannot move Cookies out of battle by effects.',
        effects: [{ kind: 'prevent-opponent-battle-movement' as const }],
      },
    }
    const target = cookie('target-lv3', 2, 4)
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ ...base.players['player-one'].battleArea[0], card: windArcher }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { ...base.players['player-two'].battleArea[0], card: timekeeper },
            { ...base.players['player-two'].battleArea[0], card: target, battleEntryId: 'target:battle:3' },
          ],
        },
      },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: windArcher.instanceId,
        sourceCardName: windArcher.name,
        sourceKind: 'skill',
        effects: [
          { kind: 'opponent-battle-to-trash', minLevel: 3, maxLevel: 3 },
        ],
        effectIndex: 0,
      },
    }
    const next: GameState = { ...previous, pendingAbilityEffect: undefined }
    const command = {
      kind: 'resolve-ability-effect' as const,
      playerId: 'player-one' as const,
      targetIds: [],
    }

    expect(describeCommand(previous, next, command)).toContain(
      `被「${timekeeper.name}」的效果阻止`,
    )
    const step = describeCommandSteps(previous, next, command)?.[0]
    expect(step?.text).toContain(`被「${timekeeper.name}」的效果阻止`)
    expect(step?.cards).toEqual([timekeeper])
  })

  it('records a movement blocker when the OnPlay UI skips BS2-058 for having no legal target', () => {
    const base = createBattleState()
    const windArcher = {
      ...cookie('wind-archer', 4, 5),
      id: 'BS2-058',
      name: 'Wind Archer Cookie',
      level: 3,
      energyColor: 'purple' as const,
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { purple: 1 },
        text: 'Place up to 1 of your opponent\'s LV.3 Cookies into the trash.',
        effects: [
          { kind: 'opponent-battle-to-trash' as const, minLevel: 3, maxLevel: 3 },
        ],
      },
    }
    const blocker = {
      ...cookie('timekeeper', 1, 4),
      id: 'BS6-010',
      name: 'Timekeeper Cookie',
      level: 3,
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'Opponents cannot move Cookies out of battle by effects.',
        effects: [{ kind: 'prevent-opponent-battle-movement' as const }],
      },
    }
    const target = cookie('target-lv3', 2, 4)
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ ...base.players['player-one'].battleArea[0], card: windArcher }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { ...base.players['player-two'].battleArea[0], card: blocker },
            { ...base.players['player-two'].battleArea[0], card: target, battleEntryId: 'target:battle:3' },
          ],
        },
      },
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: windArcher.instanceId,
        origin: 'hand',
      },
    }
    const command = {
      kind: 'skip-on-play' as const,
      playerId: 'player-one' as const,
      sourceInstanceId: windArcher.instanceId,
    }

    expect(describeCommand(previous, { ...previous, pendingOnPlay: null }, command)).toContain(
      `被「${blocker.name}」的效果阻止`,
    )
    const step = describeCommandSteps(previous, { ...previous, pendingOnPlay: null }, command)?.[0]
    expect(step?.cards).toEqual([blocker])
  })
  it('records the Timekeeper blocker when BS6-079 cannot move a valid Cookie', () => {
    const base = createBattleState()
    const croissant = {
      ...cookie('croissant', 3, 5),
      id: 'BS6-079',
      name: 'Croissant Cookie',
      energyColor: 'blue' as const,
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'Place 1 blue LV.2 or lower Cookie from your battle area on the bottom of your deck.',
        effects: [
          {
            kind: 'field-to-deck-bottom' as const,
            target: {
              side: 'self' as const,
              min: 1,
              max: 1,
              maxLevel: 2,
              energyColor: 'blue' as const,
            },
          },
        ],
      },
    }
    const target = {
      ...cookie('blue-lv2-target', 2, 3),
      name: 'Blue LV.2 Target',
      energyColor: 'blue' as const,
    }
    const timekeeper = {
      ...cookie('timekeeper', 2, 4),
      id: 'BS6-010',
      name: 'Timekeeper Cookie',
      energyColor: 'red' as const,
      skill: {
        trigger: 'passive' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'Opponents cannot move Cookies out of battle by effects.',
        effects: [{ kind: 'prevent-opponent-battle-movement' as const }],
      },
    }
    const previous: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { ...base.players['player-one'].battleArea[0], card: croissant },
            {
              ...base.players['player-one'].battleArea[0],
              card: target,
              battleEntryId: 'blue-lv2-target:battle:2',
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { ...base.players['player-two'].battleArea[0], card: timekeeper },
          ],
        },
      },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: croissant.instanceId,
        sourceCardName: croissant.name,
        sourceKind: 'skill',
        effects: [croissant.skill.effects[0]],
        effectIndex: 0,
      },
    }
    const next: GameState = { ...previous, pendingAbilityEffect: undefined }
    const resolveCommand = {
      kind: 'resolve-ability-effect' as const,
      playerId: 'player-one' as const,
      targetIds: [],
    }

    expect(describeCommand(previous, next, resolveCommand)).toContain(
      `被「${timekeeper.name}」的效果阻止`,
    )
    const resolveStep = describeCommandSteps(previous, next, resolveCommand)?.[0]
    expect(resolveStep?.text).toContain(`被「${timekeeper.name}」的效果阻止`)
    expect(resolveStep?.cards).toEqual([timekeeper])

    const skipState: GameState = {
      ...previous,
      pendingAbilityEffect: undefined,
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: croissant.instanceId,
        origin: 'hand',
      },
    }
    const skipCommand = {
      kind: 'skip-on-play' as const,
      playerId: 'player-one' as const,
      sourceInstanceId: croissant.instanceId,
    }
    const skipStep = describeCommandSteps(
      skipState,
      { ...skipState, pendingOnPlay: null },
      skipCommand,
    )?.[0]
    expect(skipStep?.text).toContain(`被「${timekeeper.name}」的效果阻止`)
    expect(skipStep?.cards).toEqual([timekeeper])
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

  it('states the actual target and damage for each step of a sequential effect-damage resolution', () => {
    const base = createBattleState()
    const flippedHpCard = base.players['player-one'].battleArea[0].hpCards[2]
    const previous: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: 'fire-spirit',
        targetInstanceId: 'defender',
        damagePlayerId: 'player-one',
        damageTargetInstanceId: 'defender',
        stage: 'damage',
        declaredDamage: 1,
        remainingDamage: 1,
        trapUsed: true,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
        effectDamageSequence: {
          remainingTargetInstanceIds: ['another-target'],
          damage: 1,
        },
      } as GameState['pendingBattle'],
    }
    const next: GameState = {
      ...previous,
      players: {
        ...previous.players,
        'player-one': {
          ...previous.players['player-one'],
          battleArea: previous.players['player-one'].battleArea.map((cookie) =>
            cookie.card.instanceId === 'defender'
              ? { ...cookie, hpCards: cookie.hpCards.slice(0, -1) }
              : cookie,
          ),
        },
      },
      pendingBattle: {
        ...previous.pendingBattle!,
        remainingDamage: 0,
        revealedHpCard: flippedHpCard,
      },
    }

    expect(
      describeCommand(previous, next, {
        kind: 'resolve-next-damage',
        playerId: 'player-one',
      }),
    ).toContain('「defender」受到 1 點傷害')
  })

  it('falls back to the generic summary when this call did not reveal a new card', () => {
    const base = createBattleState()
    const command = { kind: 'resolve-next-damage' as const, playerId: 'player-one' as const }

    expect(describeCommand(base, base, command)).toBe('防守玩家 結算了下一段傷害')
    expect(resolveLogCard(base, base, command)).toBeUndefined()
  })
})
