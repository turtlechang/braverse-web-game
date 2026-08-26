import { maskGameStateForViewer } from './masked-state'
import type { GameCommand, ApplyGameCommandOptions } from './commands'
import {
  commandFromLogEntry,
  replayCommands,
} from './replay'
import type {
  CommandLogEntry,
  GameResult,
  GameState,
  GameStatus,
  PlayerId,
  TurnPhase,
} from './types'

export const BATTLE_REPLAY_FORMAT = 'braverse-battle-replay' as const
export const BATTLE_REPLAY_VERSION = 1 as const

export type BattleReplayMode = 'offline' | 'online'
export type BattleReplayVisibility = 'full' | 'public'
export type BattleReplayLimitation =
  | 'none'
  | 'unseeded-shuffle'
  | 'missing-initial-state'
  | 'online-public-view'

export type BattleReplaySource =
  | 'production'
  | 'test-state'
  | 'benchmark'
  | 'unknown'

export type BattleReplaySampleQuality = 'behavioral' | 'snapshot' | 'invalid'

export type BattleReplayTrainingExclusion =
  | 'no-actions'
  | 'command-count-mismatch'
  | 'test-state'
  | 'unknown-source'
  | 'online-public-view'
  | 'inexact-replay'
  | 'incomplete-match'

export interface BattleReplayTrainingAssessment {
  eligible: boolean
  exclusionReasons: BattleReplayTrainingExclusion[]
}

export interface BattleReplayQualityAssessment {
  sampleQuality: BattleReplaySampleQuality
  training: BattleReplayTrainingAssessment
}

export interface BattleReplayExportV1 {
  format: typeof BATTLE_REPLAY_FORMAT
  version: typeof BATTLE_REPLAY_VERSION
  exportedAt: string
  mode: BattleReplayMode
  visibility: BattleReplayVisibility
  viewerId: PlayerId
  /** Origin label used to keep synthetic fixtures out of AI datasets. */
  source: BattleReplaySource
  /** A snapshot has no actions; a behavioral sample contains an action stream. */
  sampleQuality: BattleReplaySampleQuality
  /** Deterministic dataset gate derived from the exported evidence. */
  training: BattleReplayTrainingAssessment
  decks: { playerOne: string; playerTwo: string }
  seed: number | null
  /** Typed commands are the machine-facing replay input. */
  commands: GameCommand[]
  /** commandLog retains summaries, steps, and public card presentation for humans. */
  commandLog: CommandLogEntry[]
  /** Online exports intentionally omit the complete initial state. */
  initialState: GameState | null
  /** The final snapshot is stripped of its duplicate commandLog. */
  finalState: GameState
  outcome: {
    status: GameStatus
    result: GameResult | null
    turnNumber: number
    phase: TurnPhase
  }
  replay: {
    available: boolean
    exact: boolean
    limitation: BattleReplayLimitation
  }
}

export interface BuildBattleReplayExportOptions {
  state: GameState
  mode: BattleReplayMode
  viewerId: PlayerId
  decks: { playerOne: string; playerTwo: string }
  seed?: number | null
  initialState?: GameState | null
  /** Defaults to production for online exports and unknown for offline callers. */
  source?: Exclude<BattleReplaySource, 'unknown'>
  /** Supply a fixed clock in tests; production uses the current time. */
  now?: () => Date
}

const stripCommandLog = (state: GameState): GameState => {
  const clone: GameState = { ...state }
  delete clone.commandLog
  return clone
}

const isShuffleCommand = (command: GameCommand): boolean =>
  command.kind === 'mulligan-opening-hand' ||
  command.kind === 'force-mulligan-opening-hand' ||
  command.kind === 'refresh-deck'

const hasUnseededShuffle = (commands: readonly GameCommand[]): boolean =>
  commands.some((command) => {
    if (!isShuffleCommand(command)) return false
    const shuffleSeed = (command as GameCommand & { shuffleSeed?: unknown }).shuffleSeed
    return typeof shuffleSeed !== 'number' || !Number.isFinite(shuffleSeed)
  })

const isCardIdentifierKey = (key: string): boolean =>
  key !== 'playerId' &&
  key !== 'sourcePlayerId' &&
  (key === 'restOrder' ||
    key === 'effectTargets' ||
    /(?:instanceId|cardIds|Ids|Order)$/i.test(key))

const redactIdentifierValue = (value: unknown): unknown => {
  if (!Array.isArray(value)) return typeof value === 'string' ? 'hidden' : value
  return value.map((item) =>
    Array.isArray(item) ? item.map(() => 'hidden') : 'hidden',
  )
}

/**
 * Online commands are retained as an action-shape trace, but card identifiers
 * are not public information. The placeholder shape preserves counts and
 * command kinds for analysis while intentionally making the stream unusable
 * as a replay root (online exports already have no initialState).
 */
const redactOnlineCommand = (command: GameCommand): GameCommand => {
  const redacted = Object.fromEntries(
    Object.entries(command).map(([key, value]) => [
      key,
      isCardIdentifierKey(key) ? redactIdentifierValue(value) : value,
    ]),
  )
  return redacted as unknown as GameCommand
}

const redactOnlineCommandLog = (
  entries: readonly CommandLogEntry[],
): CommandLogEntry[] =>
  entries.map((entry) => {
    const steps = entry.steps
    const withoutCardPresentation = { ...entry }
    delete withoutCardPresentation.card
    delete withoutCardPresentation.steps
    return {
      ...withoutCardPresentation,
      payload: Object.fromEntries(
        Object.entries(entry.payload).map(([key, value]) => [
          key,
          isCardIdentifierKey(key) ? redactIdentifierValue(value) : value,
        ]),
      ),
      ...(steps
        ? {
            steps: steps.map((step) => {
              const withoutCards = { ...step }
              delete withoutCards.cards
              return withoutCards
            }),
          }
        : {}),
    }
  })

export const assessBattleReplay = (
  artifact: Pick<
    BattleReplayExportV1,
    | 'mode'
    | 'visibility'
    | 'source'
    | 'commands'
    | 'commandLog'
    | 'outcome'
    | 'replay'
  >,
): BattleReplayQualityAssessment => {
  const hasCommands = artifact.commands.length > 0
  const hasCommandLog = artifact.commandLog.length > 0
  const hasMatchingActionStreams =
    artifact.commands.length === artifact.commandLog.length
  const sampleQuality: BattleReplaySampleQuality =
    !hasCommands && !hasCommandLog
      ? 'snapshot'
      : hasCommands && hasCommandLog && hasMatchingActionStreams
        ? 'behavioral'
        : 'invalid'

  const exclusionReasons: BattleReplayTrainingExclusion[] = []
  if (!hasCommands && !hasCommandLog) {
    exclusionReasons.push('no-actions')
  }
  if (!hasMatchingActionStreams) {
    exclusionReasons.push('command-count-mismatch')
  }
  if (artifact.source === 'test-state') {
    exclusionReasons.push('test-state')
  }
  if (artifact.source === 'unknown') {
    exclusionReasons.push('unknown-source')
  }
  if (
    artifact.mode === 'online' ||
    artifact.visibility !== 'full' ||
    artifact.replay.limitation === 'online-public-view'
  ) {
    exclusionReasons.push('online-public-view')
  }
  if (!artifact.replay.available || !artifact.replay.exact) {
    exclusionReasons.push('inexact-replay')
  }
  if (artifact.outcome.status !== 'finished' || artifact.outcome.result === null) {
    exclusionReasons.push('incomplete-match')
  }

  return {
    sampleQuality,
    training: {
      eligible: exclusionReasons.length === 0,
      exclusionReasons,
    },
  }
}

export const buildBattleReplayExport = (
  options: BuildBattleReplayExportOptions,
): BattleReplayExportV1 => {
  const { state, mode, viewerId } = options
  const source: BattleReplaySource =
    options.source ?? (mode === 'online' ? 'production' : 'unknown')
  const visibility: BattleReplayVisibility = mode === 'online' ? 'public' : 'full'
  const publicState =
    mode === 'online' ? maskGameStateForViewer(state, viewerId) : state
  const sourceCommandLog = state.commandLog ?? []
  const sourceCommands = sourceCommandLog.map(commandFromLogEntry)
  const commandLog =
    mode === 'online'
      ? redactOnlineCommandLog(sourceCommandLog)
      : sourceCommandLog
  const commands =
    mode === 'online'
      ? sourceCommands.map(redactOnlineCommand)
      : sourceCommands
  const initialState =
    mode === 'online' || !options.initialState
      ? null
      : stripCommandLog(options.initialState)
  const replayLimitation: BattleReplayLimitation =
    mode === 'online'
      ? 'online-public-view'
      : !initialState
        ? 'missing-initial-state'
        : hasUnseededShuffle(commands)
          ? 'unseeded-shuffle'
          : 'none'

  const replay = {
    available: initialState !== null,
    exact: initialState !== null && replayLimitation === 'none',
    limitation: replayLimitation,
  }
  const outcome = {
    status: state.status,
    result: state.result,
    turnNumber: state.turnNumber,
    phase: state.phase,
  }
  const quality = assessBattleReplay({
    mode,
    visibility,
    source,
    commands,
    commandLog,
    outcome,
    replay,
  })

  return {
    format: BATTLE_REPLAY_FORMAT,
    version: BATTLE_REPLAY_VERSION,
    exportedAt: (options.now?.() ?? new Date()).toISOString(),
    mode,
    visibility,
    viewerId,
    source,
    sampleQuality: quality.sampleQuality,
    training: quality.training,
    decks: options.decks,
    seed: options.seed ?? null,
    commands,
    commandLog,
    initialState,
    finalState: stripCommandLog(publicState),
    outcome,
    replay,
  }
}

/**
 * Replays the machine-facing command stream when an initial state is present.
 * For unseeded opening shuffles this remains useful as a best-effort trace;
 * callers should inspect `artifact.replay.exact` before comparing snapshots.
 */
export const replayBattleExport = (
  artifact: BattleReplayExportV1,
  options: ApplyGameCommandOptions = {},
): GameState | null =>
  artifact.initialState
    ? stripCommandLog(replayCommands(artifact.initialState, artifact.commands, options))
    : null

export const serializeBattleReplayExport = (
  artifact: BattleReplayExportV1,
): string => JSON.stringify(artifact, null, 2)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPlayerId = (value: unknown): value is PlayerId =>
  value === 'player-one' || value === 'player-two'

const isBattleReplaySource = (value: unknown): value is BattleReplaySource =>
  value === 'production' ||
  value === 'test-state' ||
  value === 'benchmark' ||
  value === 'unknown'

export class BattleReplayParseError extends Error {}

/**
 * Parses the versioned outer envelope. GameState and command semantics remain
 * the rules engine's responsibility when a consumer starts a replay.
 */
export const parseBattleReplayExport = (json: string): BattleReplayExportV1 => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new BattleReplayParseError('AI 覆盤檔不是合法 JSON。')
  }

  if (!isRecord(parsed)) {
    throw new BattleReplayParseError('AI 覆盤檔必須是 JSON 物件。')
  }
  if (parsed.format !== BATTLE_REPLAY_FORMAT || parsed.version !== BATTLE_REPLAY_VERSION) {
    throw new BattleReplayParseError(
      `不支援的 AI 覆盤格式或版本：${String(parsed.format)} v${String(parsed.version)}`,
    )
  }
  if (parsed.mode !== 'offline' && parsed.mode !== 'online') {
    throw new BattleReplayParseError('AI 覆盤檔缺少合法 mode 欄位。')
  }
  if (parsed.visibility !== 'full' && parsed.visibility !== 'public') {
    throw new BattleReplayParseError('AI 覆盤檔缺少合法 visibility 欄位。')
  }
  if (!isPlayerId(parsed.viewerId)) {
    throw new BattleReplayParseError('AI 覆盤檔缺少合法 viewerId 欄位。')
  }
  let source: BattleReplaySource = 'unknown'
  if (parsed.source !== undefined) {
    if (!isBattleReplaySource(parsed.source)) {
      throw new BattleReplayParseError('AI 覆盤檔含有無法辨識的 source。')
    }
    source = parsed.source
  }
  if (!Array.isArray(parsed.commands)) {
    throw new BattleReplayParseError('AI 覆盤檔缺少 commands 陣列。')
  }
  if (!parsed.commands.every((command) => isRecord(command) && typeof command.kind === 'string')) {
    throw new BattleReplayParseError('AI 覆盤檔含有無法辨識的 command。')
  }
  if (!Array.isArray(parsed.commandLog)) {
    throw new BattleReplayParseError('AI 覆盤檔缺少 commandLog 陣列。')
  }
  if (parsed.initialState !== null && !isRecord(parsed.initialState)) {
    throw new BattleReplayParseError('AI 覆盤檔的 initialState 格式無效。')
  }
  if (!isRecord(parsed.finalState)) {
    throw new BattleReplayParseError('AI 覆盤檔缺少 finalState。')
  }
  if (!isRecord(parsed.outcome) || !isRecord(parsed.replay)) {
    throw new BattleReplayParseError('AI 覆盤檔缺少 outcome 或 replay 摘要。')
  }

  const artifact = parsed as unknown as BattleReplayExportV1
  const quality = assessBattleReplay({
    mode: artifact.mode,
    visibility: artifact.visibility,
    source,
    commands: artifact.commands,
    commandLog: artifact.commandLog,
    outcome: artifact.outcome,
    replay: artifact.replay,
  })

  // Recompute derived quality metadata so an imported file cannot claim to be
  // training-ready by editing sampleQuality or training directly. Legacy v1
  // files without source metadata remain parseable but are conservatively
  // classified as unknown-source.
  return {
    ...artifact,
    source,
    sampleQuality: quality.sampleQuality,
    training: quality.training,
  }
}
