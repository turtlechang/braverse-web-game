import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  createGame,
  type GameCard,
  type CookieCard,
  type GameState,
} from '.'

const identityShuffle = (cards: GameCard[]) => [...cards]

const createCookie = (
  instanceId: string,
  overrides: Partial<CookieCard> = {},
): CookieCard => ({
  id: `cookie-${instanceId}`,
  instanceId,
  name: `餅乾 ${instanceId}`,
  type: 'cookie',
  level: 1,
  hp: 3,
  attack: 1,
  attackCost: 0,
  ...overrides,
})

const createItem = (instanceId: string): GameCard => ({
  id: `item-${instanceId}`,
  instanceId,
  name: `道具 ${instanceId}`,
  type: 'item',
})

const createDeck = (
  prefix: string,
  starter: CookieCard,
): GameCard[] => [
  starter,
  ...Array.from({ length: 59 }, (_, index) =>
    index % 10 === 0
      ? createCookie(`${prefix}-cookie-${index}`)
      : createItem(`${prefix}-item-${index}`),
  ),
]

const createSetupGame = (
  playerOneStarter: CookieCard,
  playerTwoStarter: CookieCard,
): GameState =>
  createGame(
    { id: 'player-one', name: '玩家一', deck: createDeck('one', playerOneStarter) },
    { id: 'player-two', name: '玩家二', deck: createDeck('two', playerTwoStarter) },
    'player-one',
    identityShuffle,
  )

const createPlayingGame = (
  playerOneStarter: CookieCard,
  playerTwoStarter: CookieCard,
): GameState => {
  let state = createSetupGame(playerOneStarter, playerTwoStarter)
  state = applyGameCommand(state, {
    kind: 'select-starting-cookie',
    playerId: 'player-one',
    instanceId: playerOneStarter.instanceId,
  })
  state = applyGameCommand(state, {
    kind: 'select-starting-cookie',
    playerId: 'player-two',
    instanceId: playerTwoStarter.instanceId,
  })
  return state
}

const advanceToMain = (state: GameState) => {
  let next = state
  while (next.phase !== 'main') {
    next = applyGameCommand(next, {
      kind: 'advance-phase',
      playerId: next.activePlayerId,
    })
  }
  return next
}

// 第一回合先攻玩家不能攻擊(canAttack 規則),推進到下一回合(換人)再測試攻擊相關指令。
const advanceToSecondTurnMain = (state: GameState) => {
  let next = advanceToMain(state)
  while (next.turnNumber === 1) {
    next = applyGameCommand(next, {
      kind: 'advance-phase',
      playerId: next.activePlayerId,
    })
  }
  return advanceToMain(next)
}

describe('declare-attack 指令', () => {
  it('只開戰不自動結算,保留 pendingBattle 供陷阱/阻擋/翻面互動回應', () => {
    let state = createPlayingGame(
      createCookie('one-starter', { hp: 1 }),
      createCookie('two-starter', { attackCost: 0 }),
    )
    state = advanceToSecondTurnMain(state)
    expect(state.activePlayerId).toBe('player-two')

    state = applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: 'two-starter',
      targetInstanceId: 'one-starter',
      supportPaymentIds: [],
    })

    expect(state.status).toBe('playing')
    expect(state.pendingBattle).not.toBeNull()
    expect(state.pendingBattle?.stage).toBe('trap')
    // 尚未結算傷害,防守方戰鬥區的餅乾仍在原位。
    expect(
      state.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === 'one-starter',
      ),
    ).toBe(true)
  })

  it('拒絕非回合玩家宣告攻擊', () => {
    let state = createPlayingGame(createCookie('one-starter'), createCookie('two-starter'))
    state = advanceToSecondTurnMain(state)
    expect(state.activePlayerId).toBe('player-two')

    expect(() =>
      applyGameCommand(state, {
        kind: 'declare-attack',
        playerId: 'player-one',
        attackerInstanceId: 'one-starter',
        targetInstanceId: 'two-starter',
        supportPaymentIds: [],
      }),
    ).toThrowError('不是目前的回合玩家。')
  })
})

describe('pendingAbilityEffect 逐步效果鏈', () => {
  const starterWithDrawSkill = (instanceId: string): CookieCard =>
    createCookie(instanceId, {
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: {},
        text: '抽 1 張牌,再抽 1 張牌。',
        effects: [
          { kind: 'draw', amount: 1 },
          { kind: 'draw', amount: 1 },
        ],
      },
    })

  it('begin-activate-skill 只付代價並設定待處理效果鏈,不立即執行效果', () => {
    let state = createPlayingGame(
      starterWithDrawSkill('one-starter'),
      createCookie('two-starter'),
    )
    state = advanceToMain(state)
    const handBefore = state.players['player-one'].hand.length

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'one-starter',
      trigger: 'activate',
      paymentIds: [],
    })

    expect(state.players['player-one'].hand).toHaveLength(handBefore)
    expect(state.pendingAbilityEffect).toMatchObject({
      playerId: 'player-one',
      sourceKind: 'skill',
      effectIndex: 0,
    })
    expect(state.pendingAbilityEffect?.effects).toHaveLength(2)
  })

  it('逐步 resolve-ability-effect 執行每個效果,完成後清除待處理效果鏈', () => {
    let state = createPlayingGame(
      starterWithDrawSkill('one-starter'),
      createCookie('two-starter'),
    )
    state = advanceToMain(state)
    const handBefore = state.players['player-one'].hand.length

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'one-starter',
      trigger: 'activate',
      paymentIds: [],
    })

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-one'].hand).toHaveLength(handBefore + 1)
    expect(state.pendingAbilityEffect).toMatchObject({ effectIndex: 1 })

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.players['player-one'].hand).toHaveLength(handBefore + 2)
    expect(state.pendingAbilityEffect).toBeUndefined()
  })

  it('沒有待處理效果鏈時拒絕 resolve-ability-effect', () => {
    const state = createPlayingGame(createCookie('one-starter'), createCookie('two-starter'))

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      }),
    ).toThrowError('目前沒有待處理的效果。')
  })

  it('拒絕非待處理效果鏈所屬的玩家', () => {
    let state = createPlayingGame(
      starterWithDrawSkill('one-starter'),
      createCookie('two-starter'),
    )
    state = advanceToMain(state)
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'one-starter',
      trigger: 'activate',
      paymentIds: [],
    })

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-two',
        targetIds: [],
      }),
    ).toThrowError('不是目前需要選擇效果目標的玩家。')
  })

  it('中途出現其他待處理決策(pendingRefresh)時暫停,清空後可繼續 resolve-ability-effect', () => {
    let state = createPlayingGame(
      starterWithDrawSkill('one-starter'),
      createCookie('two-starter'),
    )
    state = advanceToMain(state)
    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'one-starter',
      trigger: 'activate',
      paymentIds: [],
    })

    // 模擬中途插入的其他待處理決策(例如補位後的 Refresh)。
    state = { ...state, pendingRefresh: { playerId: 'player-one', remainingDraws: 1 } }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [],
      }),
    ).toThrowError('必須先處理其他待處理的決策。')

    // pendingRefresh 清空後,原本待處理效果鏈仍保留、可以繼續。
    state = { ...state, pendingRefresh: null }
    expect(state.pendingAbilityEffect).toMatchObject({ effectIndex: 0 })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(state.pendingAbilityEffect).toMatchObject({ effectIndex: 1 })
  })

  it('效果佇列中的傷害會暫停在 FLIP，完成後才推進下一個效果', () => {
    const flipHp: GameCard = {
      ...createItem('effect-queue-flip-hp'),
      officialType: 'flip',
      flip: {
        text: '抽 1 張牌。',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    let state = createPlayingGame(
      starterWithDrawSkill('one-starter'),
      createCookie('two-starter', { hp: 1 }),
    )
    state = advanceToMain(state)
    state.players['player-two'].battleArea[0].hpCards = [
      createItem('effect-queue-normal-hp'),
      flipHp,
    ]
    state.players['player-one'].battleArea[0].card.skill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: true,
      restSource: false,
      cost: {},
      text: '造成 1 點傷害。',
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
    }

    state = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'one-starter',
      trigger: 'activate',
      paymentIds: [],
    })
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['two-starter'],
    })

    expect(state.pendingAbilityEffect).toBeDefined()
    expect(state.pendingBattle?.stage).toBe('damage')
    state = applyGameCommand(state, {
      kind: 'resolve-next-damage',
      playerId: 'player-two',
    })
    expect(state.pendingBattle?.stage).toBe('flip')

    state = applyGameCommand(state, {
      kind: 'resolve-flip',
      playerId: 'player-two',
      activate: false,
    })

    expect(state.pendingBattle).toBeNull()
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.players['player-two'].battleArea[0].hpCards.map((card) => card.instanceId)).toEqual([
      'effect-queue-normal-hp',
    ])
  })
})
