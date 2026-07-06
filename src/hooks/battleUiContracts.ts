import type {
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  ReplacementTask,
} from '../game'
import type { DispatchGameCommand } from './useBattleActions'

/**
 * BattleResponseModals/DamageEffectModals/PendingDecisionModals 共用的最小
 * 型別介面,取代原本寫死的 ReturnType<typeof useMatchController>,讓本地
 * useMatchController 與線上 useOnlineMatchController 的回傳值都能直接餵給
 * 同一批展示型元件(兩者結構上都滿足這個介面,不需要各自包一層轉接)。
 */
export interface BattleUiMatchLike {
  game: GameState
  viewerPlayerId: PlayerId
  opponentId: PlayerId
  dispatch: DispatchGameCommand
  // Trap
  playerTrapCandidates: GameCard[]
  selectedTrapId: string | null
  setSelectedTrapId: (value: string | null) => void
  selectedTrapDiscardIds: string[]
  setSelectedTrapDiscardIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  selectedTrapTrashBattleCookieIds: string[]
  setSelectedTrapTrashBattleCookieIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  trapSelectNoTarget: boolean
  setTrapSelectNoTarget: (value: boolean | ((current: boolean) => boolean)) => void
  selectedTrap: GameCard | undefined
  selectedTrapPaymentIds: string[]
  selectedTrapDiscardCost: number
  selectedTrapDiscardCandidates: GameCard[]
  selectedTrapTrashBattleCookieCost: number
  selectedTrapTrashBattleCookieCandidates: CookieInBattle[]
  trapAllowEmptyTarget: boolean
  selectedTrapTargets: CookieInBattle[]
  selectedTrapSupportTrashIds: string[]
  // Blocker
  selectedBlockerId: string | null
  setSelectedBlockerId: (value: string | null) => void
  playerBlockerCandidates: CookieInBattle[]
  selectedBlockerPaymentIds: string[]
  pendingResponseMode: 'trap' | 'blocker' | null
  setPendingResponseMode: (value: 'trap' | 'blocker' | null) => void
  // Flip
  selectedFlipDiscardIds: string[]
  setSelectedFlipDiscardIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  // Faint
  selectedFaintTargetIds: string[]
  setSelectedFaintTargetIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  faintSourceCard: CookieCard | null
  faintCandidates: CookieInBattle[]
  faintMin: number
  faintMax: number
  // After-damage
  selectedAfterDamageTargetIds: string[]
  setSelectedAfterDamageTargetIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  afterDamageSourceCard: CookieCard | null
  afterDamageCandidates: CookieInBattle[]
  afterDamageMin: number
  afterDamageMax: number
  // Opponent discard
  selectedOpponentDiscardIds: string[]
  setSelectedOpponentDiscardIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  // Replacement/refresh
  pendingPlayer: PlayerState | null
  pendingOptions: GameCard[]
  replacementTask: ReplacementTask | null
}

export interface BattleUiPendingEffectLike {
  pendingEffect: unknown
  faintActive: boolean
  afterDamageActive: boolean
  handleOnPlayTrigger: (state: GameState) => void
}
