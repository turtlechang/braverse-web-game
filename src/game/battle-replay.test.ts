import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  buildBattleReplayExport,
  parseBattleReplayExport,
  replayBattleExport,
  serializeBattleReplayExport,
  BattleReplayParseError,
  type CommandLogEntry,
  type GameState,
} from '.'
import { createBattleState } from './test-helpers/battle-helpers'

const fixedNow = () => new Date('2026-08-26T12:34:56.000Z')

describe('BattleReplayExportV1', () => {
  it('exports typed commands and replays an offline match to the final snapshot', () => {
    const initialState = createBattleState()
    const command = {
      kind: 'declare-attack' as const,
      playerId: 'player-two' as const,
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    }
    const finalState = applyGameCommand(initialState, command)
    const artifact = buildBattleReplayExport({
      state: finalState,
      mode: 'offline',
      viewerId: 'player-one',
      decks: { playerOne: 'fixture-one', playerTwo: 'fixture-two' },
      initialState,
      now: fixedNow,
    })

    expect(artifact.format).toBe('braverse-battle-replay')
    expect(artifact.version).toBe(1)
    expect(artifact.exportedAt).toBe('2026-08-26T12:34:56.000Z')
    expect(artifact.commands).toEqual([command])
    expect(artifact.commandLog).toHaveLength(1)
    expect(artifact.initialState?.commandLog).toBeUndefined()
    expect(artifact.finalState.commandLog).toBeUndefined()
    expect(artifact.replay).toEqual({
      available: true,
      exact: true,
      limitation: 'none',
    })

    const replayed = replayBattleExport(artifact)
    expect(replayed).not.toBeNull()
    expect(replayed?.commandLog).toBeUndefined()
    expect(replayed).toEqual(artifact.finalState)

    const restored = parseBattleReplayExport(
      serializeBattleReplayExport(artifact),
    )
    expect(restored).toEqual(artifact)
  })

  it('marks opening and refresh shuffles without a command seed as best effort', () => {
    const state = createBattleState()
    const commandLog = [
      {
        id: 1,
        turnNumber: 0,
        phase: 'active' as const,
        playerId: 'player-one' as const,
        commandKind: 'mulligan-opening-hand',
        payload: {
          kind: 'mulligan-opening-hand',
          playerId: 'player-one',
        },
      },
    ]
    const artifact = buildBattleReplayExport({
      state: { ...state, commandLog },
      mode: 'offline',
      viewerId: 'player-one',
      decks: { playerOne: 'fixture-one', playerTwo: 'fixture-two' },
      initialState: state,
      now: fixedNow,
    })

    expect(artifact.replay).toEqual({
      available: true,
      exact: false,
      limitation: 'unseeded-shuffle',
    })
  })

  it('exports online state as public data without an exact replay root', () => {
    const state = createBattleState()
    const artifact = buildBattleReplayExport({
      state,
      mode: 'online',
      viewerId: 'player-one',
      decks: { playerOne: 'unknown', playerTwo: 'unknown' },
      seed: 20260826,
      initialState: state,
      now: fixedNow,
    })

    expect(artifact.visibility).toBe('public')
    expect(artifact.initialState).toBeNull()
    expect(artifact.replay).toEqual({
      available: false,
      exact: false,
      limitation: 'online-public-view',
    })
    const serialized = serializeBattleReplayExport(artifact)
    expect(serialized).not.toContain('p2-deck-a')
    expect(serialized).not.toContain('attacker-hp')
    expect(replayBattleExport(artifact)).toBeNull()
  })

  it('redacts private card identifiers and card metadata from online traces', () => {
    const privateEntry: CommandLogEntry = {
      id: 1,
      turnNumber: 2,
      phase: 'main',
      playerId: 'player-one',
      commandKind: 'resolve-opponent-hand-discard',
      payload: {
        kind: 'resolve-opponent-hand-discard',
        playerId: 'player-one',
        cardIds: ['secret-opponent-hand-card'],
      },
      summary: '玩家選擇了要棄掉的手牌',
      card: {
        ...createBattleState().players['player-two'].hand[0],
        id: 'secret-card-id',
        instanceId: 'secret-opponent-hand-card',
        name: 'Secret Cookie',
      },
      steps: [{
        text: '不公開的選牌細節',
        cards: [{
          ...createBattleState().players['player-two'].hand[0],
          id: 'secret-step-card-id',
          instanceId: 'secret-step-card',
          name: 'Secret Step Cookie',
        }],
      }],
    }
    const artifact = buildBattleReplayExport({
      state: {
        ...createBattleState(),
        commandLog: [privateEntry],
      },
      mode: 'online',
      viewerId: 'player-one',
      decks: { playerOne: 'unknown', playerTwo: 'unknown' },
      now: fixedNow,
    })
    const serialized = serializeBattleReplayExport(artifact)

    expect(serialized).not.toContain('secret-opponent-hand-card')
    expect(serialized).not.toContain('Secret Cookie')
    expect(serialized).not.toContain('Secret Step Cookie')
    expect(artifact.commands[0]).toMatchObject({
      kind: 'resolve-opponent-hand-discard',
      playerId: 'player-one',
      cardIds: ['hidden'],
    })
  })

  it('requires the supported versioned envelope', () => {
    expect(() => parseBattleReplayExport('not json')).toThrow(
      BattleReplayParseError,
    )
    expect(() =>
      parseBattleReplayExport(
        JSON.stringify({ format: 'braverse-battle-replay', version: 2 }),
      ),
    ).toThrow('不支援的 AI 覆盤格式或版本')
    expect(() =>
      parseBattleReplayExport(
        JSON.stringify({
          format: 'braverse-battle-replay',
          version: 1,
          mode: 'offline',
          visibility: 'full',
          viewerId: 'player-one',
          commands: [{ kind: 42 }],
          commandLog: [],
          initialState: null,
          finalState: {},
          outcome: {},
          replay: {},
        }),
      ),
    ).toThrow('無法辨識的 command')
  })

  it('does not mutate snapshots when stripping command logs', () => {
    const initialState = createBattleState()
    const state: GameState = {
      ...initialState,
      commandLog: [],
    }
    const artifact = buildBattleReplayExport({
      state,
      mode: 'offline',
      viewerId: 'player-one',
      decks: { playerOne: 'fixture-one', playerTwo: 'fixture-two' },
      initialState: state,
      now: fixedNow,
    })

    expect(state.commandLog).toEqual([])
    expect(artifact.finalState.commandLog).toBeUndefined()
    expect(artifact.initialState?.commandLog).toBeUndefined()
  })
})
