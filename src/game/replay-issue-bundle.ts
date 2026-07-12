import { maskGameStateForViewer } from './masked-state'
import type { GameCommand } from './commands'
import type {
  CommandLogEntry,
  GameState,
  GameStatus,
  PlayerId,
  TurnPhase,
} from './types'

/**
 * ReplayIssueBundleV1 — 可複製、可重現的問題回報包（Phase 2）。
 *
 * 設計目標：
 * - 玩家或錯誤邊界一鍵複製 JSON，開發端能載入 `capturedState` 直接重現當下盤面，
 *   或用 `initialState` + `commandLog` 重播對局歷史。
 * - 線上對局（mode: 'online'）一律經 `maskGameStateForViewer` 遮罩後輸出，
 *   對手手牌／牌庫／隱藏 HP 卡只有佔位卡，不洩漏隱藏資訊；`initialState`
 *   在線上模式強制為 null（完整起始狀態必然含雙方牌庫內容）。
 * - `commandLog` 只含指令 payload（instanceId 與參數），不含卡牌內容，
 *   且線上端本來就會透過 state-update 收到，不構成額外洩漏。
 *
 * 重播限制（V1 已知）：未帶種子的洗牌指令（如開局調度）重播時牌序會分岔；
 * 精確重現一律以 `capturedState` 為準，`commandLog` 供人工閱讀行動序列。
 */
export interface ReplayIssueBundleV1 {
  bundleVersion: 1
  createdAt: string
  mode: 'offline' | 'online'
  viewerId: PlayerId
  /** 對局起始種子；互動對局未帶種子時為 null（Phase 3 TestScenarioV1 將補上）。 */
  seed: number | null
  /** 牌組識別標籤（內建牌組代號、'custom'、'scenario' 或 'unknown'）。 */
  decks: { playerOne: string; playerTwo: string }
  turnNumber: number
  phase: TurnPhase
  status: GameStatus
  /** 觸發回報的錯誤訊息；主動回報（無錯誤）時為 null。 */
  errorSummary: string | null
  /**
   * 觸發 errorSummary 的失敗指令。失敗指令不會進入 commandLog
   * （applyGameCommand 擲出例外時不落帳），因此需要獨立欄位
   * 才能對 capturedState 重放同一指令重現錯誤。
   */
  failedCommand: GameCommand | null
  commandLog: CommandLogEntry[]
  /** 對局起點快照（離線限定）；與 commandLog 搭配可重播歷史。 */
  initialState: GameState | null
  /** 擷取當下的狀態：離線為完整狀態，線上為遮罩後狀態。 */
  capturedState: GameState
}

export interface BuildReplayIssueBundleOptions {
  state: GameState
  mode: 'offline' | 'online'
  viewerId: PlayerId
  decks: { playerOne: string; playerTwo: string }
  seed?: number | null
  errorSummary?: string | null
  failedCommand?: GameCommand | null
  initialState?: GameState | null
  /** 供測試注入固定時間。 */
  now?: () => Date
}

/**
 * commandLog 已提升到 bundle 頂層，快照內移除以免序列化重複膨脹。
 */
const stripCommandLog = (state: GameState): GameState => {
  const clone: GameState = { ...state }
  delete clone.commandLog
  return clone
}

export const buildReplayIssueBundle = (
  options: BuildReplayIssueBundleOptions,
): ReplayIssueBundleV1 => {
  const { state, mode, viewerId } = options
  const captured =
    mode === 'online' ? maskGameStateForViewer(state, viewerId) : state
  const initialState =
    mode === 'online' ? null : (options.initialState ?? null)

  return {
    bundleVersion: 1,
    createdAt: (options.now?.() ?? new Date()).toISOString(),
    mode,
    viewerId,
    seed: options.seed ?? null,
    decks: options.decks,
    turnNumber: state.turnNumber,
    phase: state.phase,
    status: state.status,
    errorSummary: options.errorSummary ?? null,
    failedCommand: options.failedCommand ?? null,
    commandLog: state.commandLog ?? [],
    initialState: initialState ? stripCommandLog(initialState) : null,
    capturedState: stripCommandLog(captured),
  }
}

export const serializeReplayIssueBundle = (
  bundle: ReplayIssueBundleV1,
): string => JSON.stringify(bundle, null, 2)

export class ReplayIssueBundleParseError extends Error {}

/**
 * 解析並驗證問題包 JSON 外框。只驗證版本與必要欄位存在，
 * 不深度驗證 GameState 內容（載入端仍需經規則層檢查）。
 */
export const parseReplayIssueBundle = (json: string): ReplayIssueBundleV1 => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new ReplayIssueBundleParseError('問題包不是合法 JSON。')
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ReplayIssueBundleParseError('問題包必須是 JSON 物件。')
  }
  const bundle = parsed as Partial<ReplayIssueBundleV1>
  if (bundle.bundleVersion !== 1) {
    throw new ReplayIssueBundleParseError(
      `不支援的問題包版本：${String(bundle.bundleVersion)}`,
    )
  }
  if (bundle.mode !== 'offline' && bundle.mode !== 'online') {
    throw new ReplayIssueBundleParseError('問題包缺少合法 mode 欄位。')
  }
  if (!Array.isArray(bundle.commandLog)) {
    throw new ReplayIssueBundleParseError('問題包缺少 commandLog 陣列。')
  }
  if (typeof bundle.capturedState !== 'object' || bundle.capturedState === null) {
    throw new ReplayIssueBundleParseError('問題包缺少 capturedState。')
  }
  return bundle as ReplayIssueBundleV1
}
