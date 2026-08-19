import type {
  CookieCard,
  CookieInBattle,
  EnergyCost,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  ReplacementTask,
  SupportCard,
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
  selectedTrapCostOptionIndex: number
  selectTrapCostOption: (index: number) => void
  trapCostOptionLabels: string[]
  selectedTrapTrashCookieToBreakAreaIds: string[]
  setSelectedTrapTrashCookieToBreakAreaIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  selectedTrapTrashCookieToBreakAreaAmount: number
  selectedTrapTrashCookieToBreakAreaCandidates: GameCard[]
  selectedTrapDiscardIds: string[]
  setSelectedTrapDiscardIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  selectedTrapHandToBreakIds: string[]
  setSelectedTrapHandToBreakIds: (
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
  setSelectedTrapPaymentIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  trapPaymentCandidates: SupportCard[]
  trapPaymentTargetIds: Set<string>
  trapPaymentValid: boolean
  trapEnergyCostTotal: number
  toggleTrapPayment: (instanceId: string) => void
  selectedTrapDiscardCost: number
  selectedTrapDiscardCandidates: GameCard[]
  selectedTrapHandToBreakCost: number
  selectedTrapHandToBreakCandidates: GameCard[]
  selectedTrapTrashBattleCookieCost: number
  selectedTrapTrashBattleCookieCandidates: CookieInBattle[]
  trapAllowEmptyTarget: boolean
  trapTargetCandidates: CookieInBattle[]
  /**
   * Effects with their own target selector.  The array index is the original
   * trap effect index so the command can preserve empty slots for skipped
   * optional effects (for example BS5-109's two independent targets).
   */
  trapEffectTargetSteps: BattleUiTrapEffectTargetStep[]
  selectedTrapEffectTargets: string[][]
  setSelectedTrapEffectTargets: (
    value: string[][] | ((current: string[][]) => string[][]),
  ) => void
  selectTrapEffectTarget: (effectIndex: number, instanceId: string) => void
  skipTrapEffectTarget: (effectIndex: number) => void
  attackerInstanceId: string | null
  selectedTrapTargetId: string | null
  setSelectedTrapTargetId: (value: string | null) => void
  selectedTrapTargets: CookieInBattle[]
  trapSelfTargetCandidates: CookieInBattle[]
  trapSelfTargetRequired: boolean
  selectedTrapSelfTargetId: string | null
  setSelectedTrapSelfTargetId: (value: string | null) => void
  selectedTrapSelfTargets: CookieInBattle[]
  selectedTrapSupportTrashIds: string[]
  setSelectedTrapSupportTrashIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  trapSupportTrashCandidates: GameCard[]
  trapSupportTrashAmount: number
  toggleTrapSupportTrash: (instanceId: string) => void
  selectedTrapSupportToHandIds: string[]
  setSelectedTrapSupportToHandIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  trapSupportToHandCandidates: GameCard[]
  trapSupportToHandAmount: number
  toggleTrapSupportToHand: (instanceId: string) => void
  selectedTrapHandToSupportIds: string[]
  setSelectedTrapHandToSupportIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  trapHandToSupportCandidates: GameCard[]
  trapHandToSupportAmount: number
  toggleTrapHandToSupport: (instanceId: string) => void
  selectedTrapTrashToDeckIds: string[]
  setSelectedTrapTrashToDeckIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  trapTrashToDeckCandidates: GameCard[]
  trapTrashToDeckAmount: number
  toggleTrapTrashToDeck: (instanceId: string) => void
  // Blocker
  selectedBlockerId: string | null
  setSelectedBlockerId: (value: string | null) => void
  playerBlockerCandidates: CookieInBattle[]
  selectedBlockerPaymentIds: string[]
  pendingResponseMode: 'trap' | 'blocker' | 'attack-response' | null
  setPendingResponseMode: (
    value: 'trap' | 'blocker' | 'attack-response' | null,
  ) => void
  // Opponent-attack response skill
  playerAttackResponseCandidates: CookieInBattle[]
  selectedAttackResponseId: string | null
  setSelectedAttackResponseId: (value: string | null) => void
  selectedAttackResponseTrashToDeckIds: string[]
  setSelectedAttackResponseTrashToDeckIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  attackResponseTrashToDeckCandidates: GameCard[]
  attackResponseTrashToDeckAmount: number
  toggleAttackResponseTrashToDeck: (instanceId: string) => void
  selectedAttackResponseDiscardIds: string[]
  setSelectedAttackResponseDiscardIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  attackResponseDiscardCandidates: GameCard[]
  attackResponseDiscardAmount: number
  toggleAttackResponseDiscard: (instanceId: string) => void
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
  selectedFaintPaymentIds: string[]
  setSelectedFaintPaymentIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  selectedFaintCostHandIds: string[]
  setSelectedFaintCostHandIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  selectedFaintCostSupportIds: string[]
  setSelectedFaintCostSupportIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  faintSourceCard: CookieCard | null
  faintCandidates: CookieInBattle[]
  faintCardCandidates: GameCard[]
  faintCandidateLabel: string
  faintEnergyCost: EnergyCost
  faintEnergyCostTotal: number
  faintPaymentCandidates: GameCard[]
  faintPaymentValid: boolean
  toggleFaintPayment: (instanceId: string) => void
  faintCostHandAmount: number
  faintCostHandCandidates: GameCard[]
  toggleFaintCostHand: (instanceId: string) => void
  faintCostSupportAmount: number
  faintCostSupportCandidates: GameCard[]
  toggleFaintCostSupport: (instanceId: string) => void
  faintOptional: boolean
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
  // Opponent rest support (BS5-065 Petrification)
  selectedOpponentRestSupportIds: string[]
  setSelectedOpponentRestSupportIds: (
    value: string[] | ((current: string[]) => string[]),
  ) => void
  // Place hand HP (兩階段選擇第二階段)
  selectedPlaceHandHpId: string | undefined
  setSelectedPlaceHandHpId: (
    value: string | undefined | ((current: string | undefined) => string | undefined),
  ) => void
  // Replacement/refresh
  pendingPlayer: PlayerState | null
  pendingOptions: GameCard[]
  replacementTask: ReplacementTask | null
}

export interface BattleUiTrapEffectTargetStep {
  effectIndex: number
  candidates: CookieInBattle[]
  selectedTargetIds: string[]
  min: number
  max: number
  allowEmpty: boolean
}

export interface BattleUiPendingEffectLike {
  pendingEffect: unknown
  faintActive: boolean
  afterDamageActive: boolean
  handleOnPlayTrigger: (state: GameState) => void
}
