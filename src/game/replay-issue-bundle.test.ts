import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  buildReplayIssueBundle,
  createGame,
  createSeededShuffle,
  parseReplayIssueBundle,
  ReplayIssueBundleParseError,
  replayCommandLog,
  serializeReplayIssueBundle,
  type CookieCard,
  type GameCard,
  type GameCommand,
  type GameState,
  type PlayerId,
} from '.'
import { createBattleState, declareAttack } from './test-helpers/battle-helpers'

const BUNDLE_SEED = 20260712

const identityShuffle = (cards: GameCard[]) => [...cards]

const createCookie = (
  instanceId: string,
  level = 1,
  hp = 2,
): CookieCard => ({
  id: `cookie-${instanceId}`,
  instanceId,
  name: `餅乾 ${instanceId}`,
  type: 'cookie',
  level,
  hp,
  attack: 1,
  attackCost: 1,
})

const createItem = (instanceId: string): GameCard => ({
  id: `item-${instanceId}`,
  instanceId,
  name: `道具 ${instanceId}`,
  type: 'item',
})

const createDeck = (prefix: string): GameCard[] => [
  createCookie(`${prefix}-starter`, 2, 3),
  ...Array.from({ length: 59 }, (_, index) =>
    index % 10 === 0
      ? createCookie(`${prefix}-cookie-${index}`)
      : createItem(`${prefix}-item-${index}`),
  ),
]

const createInitialState = (): GameState =>
  createGame(
    { id: 'player-one', name: '玩家一', deck: createDeck('one') },
    { id: 'player-two', name: '玩家二', deck: createDeck('two') },
    'player-one',
    identityShuffle,
  )

/** 比照 replay.test.ts 的固定腳本：開局選餅乾、放支援、推進幾個階段。 */
const playScriptedMatch = (): {
  initialState: GameState
  finalState: GameState
} => {
  const options = { shuffle: createSeededShuffle(BUNDLE_SEED) }
  const initialState = createInitialState()
  let state = initialState

  const apply = (command: GameCommand) => {
    state = applyGameCommand(state, command, options)
  }
  const advanceTo = (playerId: PlayerId, phase: GameState['phase']) => {
    while (!(state.activePlayerId === playerId && state.phase === phase)) {
      apply({ kind: 'advance-phase', playerId: state.activePlayerId })
    }
  }

  apply({ kind: 'keep-opening-hand', playerId: 'player-one' })
  apply({
    kind: 'select-starting-cookie',
    playerId: 'player-one',
    instanceId: state.players['player-one'].hand.find(
      (card) => card.type === 'cookie',
    )!.instanceId,
  })
  apply({
    kind: 'select-starting-cookie',
    playerId: 'player-two',
    instanceId: 'two-starter',
  })
  advanceTo('player-one', 'support')
  apply({
    kind: 'place-support',
    playerId: 'player-one',
    instanceId: state.players['player-one'].hand.find(
      (card) => card.type === 'item',
    )!.instanceId,
  })
  advanceTo('player-two', 'support')

  return { initialState, finalState: state }
}

const OFFLINE_DECKS = { playerOne: 'test', playerTwo: 'test' }

describe('ReplayIssueBundleV1', () => {
  it('離線問題包的 initialState + commandLog 可重播出相同終局', () => {
    const { initialState, finalState } = playScriptedMatch()

    const bundle = buildReplayIssueBundle({
      state: finalState,
      mode: 'offline',
      viewerId: 'player-one',
      decks: OFFLINE_DECKS,
      seed: BUNDLE_SEED,
      initialState,
    })

    expect(bundle.bundleVersion).toBe(1)
    expect(bundle.commandLog).toHaveLength(finalState.commandLog?.length ?? -1)
    expect(bundle.turnNumber).toBe(finalState.turnNumber)
    expect(bundle.phase).toBe(finalState.phase)
    // 快照內不重複攜帶 commandLog（已提升到 bundle 頂層）。
    expect(bundle.capturedState.commandLog).toBeUndefined()
    expect(bundle.initialState?.commandLog).toBeUndefined()

    const replayed = replayCommandLog(bundle.initialState!, bundle.commandLog, {
      shuffle: createSeededShuffle(BUNDLE_SEED),
    })
    const stripLog = (state: GameState) => {
      const clone = { ...state }
      delete clone.commandLog
      return clone
    }
    expect(JSON.stringify(stripLog(replayed))).toBe(
      JSON.stringify(bundle.capturedState),
    )
  })

  it('線上問題包經過視角遮罩：對手手牌／牌庫／隱藏 HP 卡不出現，initialState 強制為 null', () => {
    const state = createBattleState()

    const bundle = buildReplayIssueBundle({
      state,
      mode: 'online',
      viewerId: 'player-one',
      decks: { playerOne: 'unknown', playerTwo: 'unknown' },
      // 即使呼叫端誤傳 initialState（含雙方完整牌庫），線上模式也必須丟棄。
      initialState: state,
    })

    expect(bundle.initialState).toBeNull()

    const opponent = bundle.capturedState.players['player-two']
    expect(opponent.hand.every((card) => card.id === 'hidden')).toBe(true)
    expect(opponent.deck.every((card) => card.id === 'hidden')).toBe(true)
    expect(
      opponent.battleArea.every((cookie) =>
        cookie.hpCards.every((card) => card.id === 'hidden'),
      ),
    ).toBe(true)

    // 自己的手牌保持原樣，回報內容仍可供除錯。
    expect(
      bundle.capturedState.players['player-one'].hand.some(
        (card) => card.instanceId === 'p1-hand-a',
      ),
    ).toBe(true)

    // 字串層級保證：序列化輸出完全不含對手隱藏卡的 instanceId。
    const json = serializeReplayIssueBundle(bundle)
    expect(json).not.toContain('p2-replacement')
    expect(json).not.toContain('p2-deck-a')
    expect(json).not.toContain('"attacker-hp"')
  })

  it('重現真實錯誤案例：漏付 trashBattleCookie 代價的 play-trap（BS2-077／ST5-020 類）', () => {
    // 真人試玩 2026-07-12 回報過同類 bug：卡牌代價未支付即結算效果。
    // 修復後引擎會擲例外；問題包記錄失敗指令與狀態，開發端 parse 後
    // 重放同一指令必須得到一模一樣的錯誤。
    const trap: GameCard = {
      id: 'ST5-020',
      instanceId: 'st5-020-test',
      name: 'Forbidden Grimoire',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Place 1 purple LV.1 Cookie from your battle area into the trash.',
        cost: {
          energy: {},
          discardHand: 0,
          trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
        },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state.players['player-one'].battleArea[0].card.energyColor = 'purple'
    state = declareAttack(state)

    const failingCommand: GameCommand = {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: ['attacker'],
      // 漏掉 trashBattleCookieIds → 代價未付，引擎必須拒絕。
    }

    let errorSummary = ''
    try {
      applyGameCommand(state, failingCommand)
      expect.unreachable('漏付代價的 play-trap 應該擲出例外')
    } catch (error) {
      errorSummary = error instanceof Error ? error.message : String(error)
    }
    expect(errorSummary).toContain('戰鬥區餅乾')

    const bundle = buildReplayIssueBundle({
      state,
      mode: 'offline',
      viewerId: 'player-one',
      decks: OFFLINE_DECKS,
      errorSummary,
      failedCommand: failingCommand,
    })

    // serialize → parse 後重放失敗指令，重現同一錯誤訊息。
    const restored = parseReplayIssueBundle(serializeReplayIssueBundle(bundle))
    expect(restored.errorSummary).toBe(errorSummary)
    expect(restored.failedCommand).not.toBeNull()
    expect(() =>
      applyGameCommand(restored.capturedState, restored.failedCommand!),
    ).toThrow(errorSummary)
  })

  it('serialize → parse round-trip 保留完整欄位', () => {
    const { initialState, finalState } = playScriptedMatch()
    const bundle = buildReplayIssueBundle({
      state: finalState,
      mode: 'offline',
      viewerId: 'player-one',
      decks: OFFLINE_DECKS,
      seed: BUNDLE_SEED,
      initialState,
      now: () => new Date('2026-07-12T00:00:00.000Z'),
    })

    const restored = parseReplayIssueBundle(serializeReplayIssueBundle(bundle))
    expect(restored).toEqual(bundle)
    expect(restored.createdAt).toBe('2026-07-12T00:00:00.000Z')
  })

  it('parse 拒絕非 JSON、錯誤版本與缺欄位的輸入', () => {
    expect(() => parseReplayIssueBundle('not json')).toThrow(
      ReplayIssueBundleParseError,
    )
    expect(() => parseReplayIssueBundle('"a string"')).toThrow(
      ReplayIssueBundleParseError,
    )
    expect(() => parseReplayIssueBundle('{"bundleVersion":2}')).toThrow(
      '不支援的問題包版本',
    )
    expect(() =>
      parseReplayIssueBundle('{"bundleVersion":1,"mode":"lan"}'),
    ).toThrow('mode')
    expect(() =>
      parseReplayIssueBundle('{"bundleVersion":1,"mode":"offline"}'),
    ).toThrow('commandLog')
    expect(() =>
      parseReplayIssueBundle(
        '{"bundleVersion":1,"mode":"offline","commandLog":[]}',
      ),
    ).toThrow('capturedState')
  })
})
