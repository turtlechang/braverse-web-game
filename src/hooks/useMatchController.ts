import { getBattleCookiePositionCostCandidates } from '../game/battle-position-cost'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { describeOpeningDeal } from '../game/presentation'
import type { BattleReplayAiMetadata, CookieCard, CookieInBattle, GameCommand, GameState, PlayerId, PlayerState, ReplacementTask, ReplayIssueBundleV1, SupportCard } from '../game'
import {
  applyGameCommand,
  createDemoSetupGame,
  getCurrentReplacementTask,
  getAfterDamageEffectCandidates,
  getAfterDamageEffectSourceCard,
  getAfterDamageEffectMinMax,
  getFaintEffectCardCandidates,
  getFaintEffectCandidateLabel,
  getBlockerCandidates,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  getAttackResponseSkillCandidates,
  getDiscardHandCostCandidates,
  getSupportEffectCandidates,
  getPendingDecision,
  hasBlockingPending,
  hasPendingCardResolution,
  getReplacementCandidates,
  getRefreshCandidates,
  explainUnavailableTraps,
  getTrapCandidates,
  getTrapCostOptions,
  getTrapTargetCandidates,
  getEffectTargetCandidatesForEffect,
  getEffectSelectionCandidates,
  getEffectTargetSelectionLimits,
  getTrapSelfTargetCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashCookieToBreakAreaCostCandidates,
  getTrashToDeckCandidates,
  buildReplayIssueBundle,
  buildBattleReplayExport,
  getEnergyCostTotal,
  isSupportToHandCostCandidate,
  isEnergyColorCompatibleWithCost,
  isPlayerControllingState,
  getActingPlayerId,
  isEffectConditionMet,
  requiresEffectCardSelection,
  requiresTargetSelection,
  getTrashToDeckCostCandidates,
  validateEnergyPayment,
  type BuiltInDeckChoice,
  type DeckChoice,
} from '../game'
import {
  createAttackEffectDemoState,
  createBs8076ActivePreventionDemoState,
  createBs8084AttackRequirementDemoState,
  createBs8011DoubleSkillDemoState,
  createBs8011FaintContinuationDemoState,
  createBs8ExtraDeckDemoState,
  createBs10ExtraDeckDemoState,
  createAiDiscardRevealDemoState,
  createBlockerResponseDemoState,
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createBreakToTrashDemoState,
  createBs2015CostDepartureDemoState,
  createCardCheckDemoState,
  createBs4077TimekeeperCostDemoState,
  createBs4026OnPlayDemoState,
  createBs6031AttackAfterDemoState,
  createBs6079OnPlayDemoState,
  createBs6008TrapDemoState,
  createBs8021TrapDemoState,
  createBs8GreenConditionDemoState,
  createPConditionDemoState,
  createSoulJamEquippedDemoState,
  createSoulJam115ProtectionDemoState,
  createFaintDamageDemoState,
  createFlipResponseDemoState,
  createItemUsageDemoState,
  createPretzelSnareDemoState,
  createReplacementChoiceDemoState,
  createSt5010OnPlayDemoState,
  createOpponentDiscardHandDemoState,
  createStageUsageDemoState,
  createSupportToTrashSkillDemoState,
  createTrapAndBlockerDemoState,
  createTrapResponseDemoState,
  createBlueSt4DemoState,
  createBlueSt4TrapDemoState,
  createBs4ConditionDemoState,
  createBs4024TargetRestrictionDemoState,
  createBs3SilverbellConditionDemoState,
  createBs5CroissantEndPhaseDemoState,
  createBs5FlipDemoState,
  createBs9CandidatePreviewDemoState,
  createBs9041AttackDemoState,
  createBs9041OwnTurnDemoState,
  createBs9018ProtectionDemoState,
  createBs9018KumihoAttackDemoState,
  createBs5FaintDemoState,
  createBs5TrapDemoState,
  createBs5ItemConditionDemoState,
  createBs5StageConditionDemoState,
  createBs5Item111DemoState,
  createBs9ActualDamageDemoState,
  createBs1008FlipPreviewDemoState,
  createBs1009HpCostPreviewDemoState,
  createBs11FlipPreviewDemoState,
  createBs11TwelfthBatchDemoState,
  createBs11ThirteenthBatchDemoState,
  createBs11064ReplacementDemoState,
  createBs11066TrapDemoState,
  createBs11067AttackDemoState,
  createBs11068FaintDemoState,
  createBs11069ResponseDemoState,
  createBs11070OnPlayDemoState,
  createBs11070AttackDemoState,
  createBs11071AttackDemoState,
  createBs11072SkillDemoState,
  createBs11073AttackDemoState,
  createBs11074AttackDemoState,
  createBs11077AuraDemoState,
  createBs11078AttackDemoState,
  createBs11079OnPlayDemoState,
  createBs11080ItemDemoState,
  createBs11081ItemDemoState,
  createBs11082TrapDemoState,
  createBs11083StageDemoState,
  createBs11083ReplacementDemoState,
  createBs11VanillaAttackDemoState,
  createBs12AttackDemoState,
  createBs12FlipDemoState,
  createBs12ActivateDemoState,
  createBs12PositionCostDemoState,
  createBs12EquipDemoState,
  createBs12ReadyDemoState,
  createBs12TrapDemoState,
  createBs12YappingDemoState,
  createBs12EntranceDemoState,
  createBs12WorkshopDemoState,
  createBs12SpotlightDemoState,
  createBs12ChouxDemoState,
  createBs12EspressoDemoState,
  createBs12MadeleineDemoState,
  createBs12KouignDemoState,
  createBs12ClottedDemoState,
  createBs12FinancierDemoState,
  createBs12GreenbellDemoState,
  createBs12CarpetDemoState,
  createBs12OptionalTrapDemoState,
  createBs12StageDemoState,
  createBs12GuitarDemoState,
  createBs12RecordDemoState,
  createBs12ActivePhaseDemoState,
  createBs12ParfaitDemoState,
  createBs12MochiDemoState,
  createBs12CandyAppleDemoState,
  createBs12GlitterDemoState,
  createBs12MuscleDemoState,
  createBs12MelonDemoState,
  createBs12BasilDemoState,
  createBs12BaguetteDemoState,
  createBs12StrawberryDemoState,
  createBs12MangoDemoState,
  createBs12MintWaferDemoState,
  createBs12ChamomileDemoState,
  createBs12KohlrabiDemoState,
  createBs12CoffeeCandyDemoState,
  createBs12HerbTeapotDemoState,
  createBs12CloverDemoState,
  createBs12CameraDemoState,
  createBs12HarmonyDemoState,
  createBs12OrchestraDemoState,
  createBs12AudienceDemoState,
  createBs12MelodyDemoState,
  createBs12FerretDemoState,
  createBs12CocoaDemoState,
  createBs12MarbleberryDemoState,
  createBs12PeppermintDemoState,
  createBs12SourBeltDemoState,
  createBs12SorbetSharkDemoState,
  createBs12SonicWaterDemoState,
  createBs12CakePopsDemoState,
  createBs12AngelLightstickDemoState,
  createBs12CreamPuffDemoState,
  createBs12FanLetterDemoState,
  createBs12EndingPoseDemoState,
  createBs12ComebackStageDemoState,
  createBs12MultivitaminDemoState,
  createBs12PhotocardDemoState,
  createBs12StardustDemoState,
  createBs12IcePopDemoState,
  createBs12CreamSodaDemoState,
  createBs12DjMiyaDemoState,
  createBs12PoppingCandyDemoState,
  createBs12GnomeBandDemoState,
  createBs12BlackberryDemoState,
  createBs12SpotlightFanDemoState,
  createBs12OnionDemoState,
  createBs12CurrantCreamDemoState,
  createBs12PuddingDemoState,
  createBs12DjDemoState,
  createBs12GuitarStringDemoState,
  createBs12SummerSodaDemoState,
  createBs12RainbowHeadphonesDemoState,
  createBs12TrueRockSpiritDemoState,
  createBs12UnderstandingDemoState,
  createBs12BlackSapphireDemoState,
  createBs12WerewolfDemoState,
  createBs12MilkyWayDemoState,
  createBs12CaramelArrowDemoState,
  createBs12BlackLemonadeDemoState,
  createBs12RockstarDemoState,
  createBs12ButterRollDemoState,
  createBs12JasmineDemoState,
  createBs12BlueberryDemoState,
  createBs12CrimsonDemoState,
  createBs12CaramelPuddingDemoState,
  createBs12CakeHoundDemoState,
  createBs12StrategistDemoState,
  createBs12ChessChocoDemoState,
  createBs12CoffeeTruckDemoState,
  createBs12SunglassesDemoState,
  createBs12RecipeDemoState,
  createBs12PerfectStageDemoState,
  createBs12TailPhysicalDemoState,
  createBs12FinalPhysicalDemoState,
  createBs12RulingsDemoState,
  createBs12KumihoDemoState,
  createBs12MintChocoDemoState,
  createBs12HerbDemoState,
  createBs12AppleFaerieDemoState,
  createBs12BonbonDemoState,
  createBs12GingerBraveDemoState,
  createBs12MayorDemoState,
  createBs12BananaRotiDemoState,
  createBs12EquippedAttackDemoState,
  createBs11RedSkillDemoState,
  createBs11006OnPlayDemoState,
  createBs11RedConditionalItemDemoState,
  createBs11011StageDemoState,
  createBs11013TrapDemoState,
  createBs11010TrapDemoState,
  createBs11014AttackDemoState,
  createBs11015AttackDemoState,
  createBs11092ActivateDemoState,
  createBs11094BlockerDemoState,
  createBs11108StageDemoState,
  createBs11017AttackDemoState,
  createBs11ConditionalActivateDemoState,
  createBs11018AttackDemoState,
  createBs11018SkillDemoState,
  createBs11025AttackDemoState,
  createBs11024FaintDemoState,
  createBs11026SkillDemoState,
  createBs11YellowItemDemoState,
  createBs11027TrapDemoState,
  createBs11028StageDemoState,
  createBs11029TrapDemoState,
  createBs11033AttackDemoState,
  createBs11036SkillDemoState,
  createBs11036AttackDemoState,
  createBs11032AttackDemoState,
  createBs11032EndTurnDemoState,
  createBs11034BreakSkillDemoState,
  createBs11034AttackDemoState,
  createBs11035OnPlayDemoState,
  createBs11035AttackDemoState,
  createBs11BlackAttackThenDemoState,
  createBs11089AttackDemoState,
  createBs11031ActivateContinuationDemoState,
  createBs11027AttackCostContinuationDemoState,
  createBs11FourteenthBatchDemoState,
  createBs10ConditionDemoState,
  createBs6ConditionDemoState,
  createCardNegativeDemoState,
  createP082TrapDemoState,
  createP084ItemConditionDemoState,
  createP147SpecialPlayDemoState,
  createBs11097To099SpecialPlayGateDemoState,
  createBs11103104109InspectDemoState,
  createBs11106107110ConditionDemoState,
  createBs11088105AttackThenDemoState,
  createBs11088OnPlayDemoState,
  createBs11084TrapDemoState,
  createBs11016HpTotalDemoState,
  createBs11086087AttackThenDemoState,
  createBs111113SpecialPlayDemoState,
  createBs11114OnPlayDemoState,
  createBs11089OnPlayDemoState,
  createBs11090ExtraDeckDemoState,
  createBs11115SpecialPlayDemoState,
  createBs11116ExtraDeckDemoState,
  createBs11116MovementProtectionDemoState,
  createBs3SpecialVictoryDemoState,
  parseTestStateConfig,
} from '../game/demo'
import { useMatchSetup } from './useMatchSetup'
import { useMatchAnimations } from './useMatchAnimations'
import { registerIssueBundleProvider } from './issueBundleSource'
import {
  useBattleActions,
  type DispatchGameCommand,
  type RunGameAction,
} from './useBattleActions'

type TestStateConfig = ReturnType<typeof parseTestStateConfig>

const opponentOfId = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

export const getPendingChoicePlayerId = (
  game: GameState,
  replacementTask: ReplacementTask | null,
): PlayerId | undefined => {
  if (game.pendingRefresh) return game.pendingRefresh.playerId
  if (game.pendingOnPlay) return undefined

  const pendingDecision = getPendingDecision(game)
  if (!replacementTask) return undefined

  // Effects have priority over replacement. Keep the replacement player
  // hidden until the entire card-resolution chain is empty.
  if (hasPendingCardResolution(game)) return undefined

  return !pendingDecision ||
    pendingDecision.kind === 'faint-effect' ||
    pendingDecision.kind === 'effect-order'
    ? replacementTask.playerId
    : undefined
}

export function useMatchController(params: {
  testStateConfig: TestStateConfig | null
}) {
  const { testStateConfig } = params

  const [game, setGame] = useState(() => {
    if (testStateConfig?.kind === 'break-to-trash') {
      return createBreakToTrashDemoState(testStateConfig.level)
    }
    if (testStateConfig?.kind === 'trap-response') {
      return createTrapResponseDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blocker-response') {
      return createBlockerResponseDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'trap-and-blocker-response') {
      return createTrapAndBlockerDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'flip-response') {
      return createFlipResponseDemoState()
    }
    if (testStateConfig?.kind === 'replacement-choice') {
      return createReplacementChoiceDemoState()
    }
    if (testStateConfig?.kind === 'st5-010-on-play') {
      return createSt5010OnPlayDemoState()
    }
    if (testStateConfig?.kind === 'ai-discard-reveal') {
      return createAiDiscardRevealDemoState()
    }
    if (testStateConfig?.kind === 'item-usage') {
      return createItemUsageDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'stage-usage') {
      return createStageUsageDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'faint-damage') {
      return createFaintDamageDemoState()
    }
    if (testStateConfig?.kind === 'trap-pretzel') {
      return createPretzelSnareDemoState(testStateConfig.attack)
    }
    if (testStateConfig?.kind === 'opponent-discard-hand') {
      return createOpponentDiscardHandDemoState()
    }
    if (testStateConfig?.kind === 'attack-effect') {
      return createAttackEffectDemoState()
    }
    if (testStateConfig?.kind === 'bs8-extra-deck') {
      return createBs8ExtraDeckDemoState(
        testStateConfig.conditionMet,
        testStateConfig.cardNumber,
        testStateConfig.cardNumber,
        testStateConfig.orderedTargets,
      )
    }
    if (testStateConfig?.kind === 'bs10-extra-deck') {
      return createBs10ExtraDeckDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs9-candidate') {
      return createBs9CandidatePreviewDemoState(
        testStateConfig.cardNumber,
        testStateConfig.negative,
      )
    }
    if (testStateConfig?.kind === 'bs10-008-flip') {
      return createBs1008FlipPreviewDemoState(testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs10-009-hp-cost') {
      return createBs1009HpCostPreviewDemoState(testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs11-flip') {
      return createBs11FlipPreviewDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-071-hp-no-flip') {
      return createBs11FlipPreviewDemoState('BS11-071@2', false)
    }
    if (testStateConfig?.kind === 'bs11-twelfth-batch') {
      return createBs11TwelfthBatchDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-thirteenth-batch') {
      return createBs11ThirteenthBatchDemoState(
        testStateConfig.cardNumber,
        testStateConfig.scenario,
      )
    }
    if (testStateConfig?.kind === 'bs11-064-replacement') {
      return createBs11064ReplacementDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-066-trap') {
      return createBs11066TrapDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-067-attack') {
      return createBs11067AttackDemoState(testStateConfig.cardNumber, testStateConfig.thenPayable)
    }
    if (testStateConfig?.kind === 'bs11-068-faint') {
      return createBs11068FaintDemoState(testStateConfig.cardNumber, testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-069-response') {
      return createBs11069ResponseDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-070-on-play') {
      return createBs11070OnPlayDemoState(testStateConfig.cardNumber, testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-070-attack') {
      return createBs11070AttackDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs11-071-attack') {
      return createBs11071AttackDemoState(testStateConfig.cardNumber, testStateConfig.thenPayable)
    }
    if (testStateConfig?.kind === 'bs11-072-skill') {
      return createBs11072SkillDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-073-attack') {
      return createBs11073AttackDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-074-attack') {
      return createBs11074AttackDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-077-aura') {
      return createBs11077AuraDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-078-attack') {
      return createBs11078AttackDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-079-on-play') {
      return createBs11079OnPlayDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-080-item') {
      return createBs11080ItemDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-081-item') {
      return createBs11081ItemDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-082-trap') {
      return createBs11082TrapDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-083-stage') {
      return createBs11083StageDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-083-replacement') {
      return createBs11083ReplacementDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs12-attack') {
      return createBs12AttackDemoState(testStateConfig.cardNumber, testStateConfig.payable, testStateConfig.blockedColor, testStateConfig.blockedRest)
    }
    if (testStateConfig?.kind === 'bs12-006') {
      return createBs12PositionCostDemoState(testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs12-008') return createBs12ReadyDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-009') return createBs12TrapDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-010') return createBs12OptionalTrapDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-027') return createBs12YappingDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-029') return createBs12EntranceDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-030') return createBs12WorkshopDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-031') return createBs12SpotlightDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-032') return createBs12ChouxDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-033') return createBs12EspressoDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-034') return createBs12MadeleineDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-035') return createBs12KouignDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-036') return createBs12ClottedDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-037') return createBs12FinancierDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-038') return createBs12GreenbellDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-028') return createBs12CarpetDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-011') return createBs12StageDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-012') return createBs12GuitarDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-013') return createBs12RecordDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-015') return createBs12ParfaitDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-016') return createBs12MochiDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-017') return createBs12CandyAppleDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-018') return createBs12GlitterDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-019') return createBs12MuscleDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-039') return createBs12MelonDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-041') return createBs12BasilDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-040') return createBs12BaguetteDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-020') return createBs12StrawberryDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-021') return createBs12MangoDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-022') return createBs12MintWaferDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-042') return createBs12ChamomileDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-080') return createBs12KohlrabiDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-043') return createBs12CoffeeCandyDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-044') return createBs12HerbTeapotDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-045') return createBs12CloverDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-046') return createBs12CameraDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-047') return createBs12HarmonyDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-048') return createBs12OrchestraDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-049') return createBs12AudienceDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-050') return createBs12MelodyDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-051') return createBs12FerretDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-052') return createBs12CocoaDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-053') return createBs12KumihoDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-054') return createBs12MintChocoDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-055') return createBs12HerbDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-056') return createBs12AppleFaerieDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-063') return createBs12CakePopsDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-062') return createBs12AngelLightstickDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-064') return createBs12CreamPuffDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-065') return createBs12FanLetterDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-066') return createBs12EndingPoseDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-067') return createBs12ComebackStageDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-068') return createBs12MultivitaminDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-069') return createBs12PhotocardDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-070') return createBs12StardustDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-071') return createBs12IcePopDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-072') return createBs12CreamSodaDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-073') return createBs12DjMiyaDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-074') return createBs12PoppingCandyDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-075') return createBs12GnomeBandDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-076') return createBs12BlackberryDemoState(testStateConfig.scenario)
      if (testStateConfig?.kind === 'bs12-077') return createBs12SpotlightFanDemoState(testStateConfig.scenario)
      if (testStateConfig?.kind === 'bs12-078') return createBs12OnionDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-079') return createBs12CurrantCreamDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-081') return createBs12PuddingDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-082') return createBs12DjDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-083') return createBs12GuitarStringDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-084') return createBs12SummerSodaDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-085') return createBs12RainbowHeadphonesDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-086') return createBs12TrueRockSpiritDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-087') return createBs12UnderstandingDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-088') return createBs12BlackSapphireDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-090') return createBs12MilkyWayDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-091') return createBs12CaramelArrowDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-092') return createBs12BlackLemonadeDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-093') return createBs12RockstarDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-094') return createBs12ButterRollDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-097') return createBs12JasmineDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-095') return createBs12BlueberryDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-096') return createBs12CrimsonDemoState(testStateConfig.scenario, true)
    if (testStateConfig?.kind === 'bs12-098') return createBs12CaramelPuddingDemoState(testStateConfig.scenario, true)
    if (testStateConfig?.kind === 'bs12-099') return createBs12CakeHoundDemoState(testStateConfig.scenario, true)
    if (testStateConfig?.kind === 'bs12-100') return createBs12StrategistDemoState(testStateConfig.scenario, true)
    if (testStateConfig?.kind === 'bs12-101') return createBs12ChessChocoDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-102') return createBs12CoffeeTruckDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-103') return createBs12SunglassesDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-104') return createBs12RecipeDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-105') return createBs12PerfectStageDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-final') return createBs12FinalPhysicalDemoState(testStateConfig.cardNumber,testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-rulings') return createBs12RulingsDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-tail') return createBs12TailPhysicalDemoState(testStateConfig.cardNumber,testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-089') return createBs12WerewolfDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-061') return createBs12SonicWaterDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-060') return createBs12SorbetSharkDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-059') return createBs12SourBeltDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-057') return createBs12MarbleberryDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-058') return createBs12PeppermintDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-023') return createBs12BonbonDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-024') return createBs12GingerBraveDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-025') return createBs12MayorDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-026') return createBs12BananaRotiDemoState(testStateConfig.scenario)
    if (testStateConfig?.kind === 'bs12-014') return createBs12ActivePhaseDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    if (testStateConfig?.kind === 'bs12-007') return ['equipped', 'unequipped'].includes(testStateConfig.scenario)
      ? createBs12EquippedAttackDemoState(testStateConfig.scenario === 'equipped')
      : createBs12EquipDemoState(testStateConfig.scenario as Parameters<typeof createBs12EquipDemoState>[0])
    if (testStateConfig?.kind === 'bs12-005') {
      return createBs12ActivateDemoState(testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs12-flip') {
      return createBs12FlipDemoState(testStateConfig.scenario, testStateConfig.cardNumber)
    }
    if (testStateConfig?.kind === 'bs11-vanilla-attack') {
      return createBs11VanillaAttackDemoState(testStateConfig.cardNumber, testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-red-skill') {
      return createBs11RedSkillDemoState(testStateConfig.cardNumber, testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-006-on-play') {
      return createBs11006OnPlayDemoState(testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs11-red-conditional-item') {
      return createBs11RedConditionalItemDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-011-stage') {
      return createBs11011StageDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-013-trap') {
      return createBs11013TrapDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-010-trap') {
      return createBs11010TrapDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-014-attack') {
      return createBs11014AttackDemoState(testStateConfig.cardNumber, testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-015-attack') {
      return createBs11015AttackDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs11-092-activate') {
      return createBs11092ActivateDemoState(testStateConfig.alreadyUsed)
    }
    if (testStateConfig?.kind === 'bs11-094-blocker') {
      return createBs11094BlockerDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-108-stage') {
      return createBs11108StageDemoState(testStateConfig.specialPlay, testStateConfig.cardNumber)
    }
    if (testStateConfig?.kind === 'bs11-017-attack') {
      return createBs11017AttackDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs11-conditional-activate') {
      return createBs11ConditionalActivateDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-018-attack') {
      return createBs11018AttackDemoState(testStateConfig.cardNumber, testStateConfig.scenario)
    }
    if (testStateConfig?.kind === 'bs11-018-skill') {
      return createBs11018SkillDemoState(testStateConfig.cardNumber, testStateConfig.alreadyUsed)
    }
    if (testStateConfig?.kind === 'bs11-025-attack') {
      return createBs11025AttackDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-024-faint') {
      return createBs11024FaintDemoState(testStateConfig.hasLv3)
    }
    if (testStateConfig?.kind === 'bs11-026-skill') {
      return createBs11026SkillDemoState(testStateConfig.hasFlip)
    }
    if (testStateConfig?.kind === 'bs11-yellow-item') {
      return createBs11YellowItemDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-031-activate-continuation') {
      return createBs11031ActivateContinuationDemoState(testStateConfig.canDiscardTwo)
    }
    if (testStateConfig?.kind === 'bs11-027-trap') {
      return createBs11027TrapDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs11-027-attack-cost-continuation') {
      return createBs11027AttackCostContinuationDemoState(testStateConfig.canPayExtra)
    }
    if (testStateConfig?.kind === 'bs11-028-stage') {
      return createBs11028StageDemoState(testStateConfig.hasYellowCookie)
    }
    if (testStateConfig?.kind === 'bs11-029-trap') {
      return createBs11029TrapDemoState(testStateConfig.cardNumber, testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-033-attack') {
      return createBs11033AttackDemoState(testStateConfig.cardNumber, testStateConfig.gainedHp)
    }
    if (testStateConfig?.kind === 'bs11-036-skill') {
      return createBs11036SkillDemoState(testStateConfig.cardNumber, testStateConfig.hasOther)
    }
    if (testStateConfig?.kind === 'bs11-036-attack') {
      return createBs11036AttackDemoState(testStateConfig.cardNumber, testStateConfig.lowHp)
    }
    if (testStateConfig?.kind === 'bs11-032-attack') {
      return createBs11032AttackDemoState(testStateConfig.cardNumber, testStateConfig.hasOther)
    }
    if (testStateConfig?.kind === 'bs11-032-end-turn') {
      return createBs11032EndTurnDemoState(testStateConfig.cardNumber, testStateConfig.playedLevelThree)
    }
    if (testStateConfig?.kind === 'bs11-034-break-skill') {
      return createBs11034BreakSkillDemoState(testStateConfig.cardNumber, testStateConfig.hasLevelSum)
    }
    if (testStateConfig?.kind === 'bs11-034-attack') {
      return createBs11034AttackDemoState(testStateConfig.cardNumber, testStateConfig.hasAncients)
    }
    if (testStateConfig?.kind === 'bs11-035-on-play') {
      return createBs11035OnPlayDemoState(testStateConfig.cardNumber, testStateConfig.hasHandCost)
    }
    if (testStateConfig?.kind === 'bs11-035-attack') {
      return createBs11035AttackDemoState(testStateConfig.cardNumber, testStateConfig.hasFlip)
    }
    if (testStateConfig?.kind === 'bs11-black-attack-then') {
      return createBs11BlackAttackThenDemoState(testStateConfig.cardNumber, testStateConfig.hasThenCost)
    }
    if (testStateConfig?.kind === 'bs11-089-attack') {
      return createBs11089AttackDemoState(testStateConfig.cardNumber, testStateConfig.refreshed)
    }
    if (testStateConfig?.kind === 'bs11-fourteenth-batch') {
      return createBs11FourteenthBatchDemoState(
        testStateConfig.cardNumber,
        testStateConfig.scenario,
      )
    }
    if (testStateConfig?.kind === 'bs10-condition') {
      return createBs10ConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs9-damage') {
      return createBs9ActualDamageDemoState(
        testStateConfig.cardNumber,
        testStateConfig.negative,
      )
    }
    if (testStateConfig?.kind === 'bs9-protection') {
      return createBs9018ProtectionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.negative,
      )
    }
    if (testStateConfig?.kind === 'bs9-018-kumiho') {
      return createBs9018KumihoAttackDemoState(
        testStateConfig.cardNumber,
        testStateConfig.negative,
        testStateConfig.targetCardNumber,
      )
    }
    if (testStateConfig?.kind === 'bs9-041-attack') {
      return createBs9041AttackDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs9-041-own-turn') {
      return createBs9041OwnTurnDemoState(
        testStateConfig.cardNumber,
        testStateConfig.negative,
      )
    }
    if (testStateConfig?.kind === 'bs8-011-double-skill') {
      return createBs8011DoubleSkillDemoState()
    }
    if (testStateConfig?.kind === 'bs8-011-faint-continuation') {
      return createBs8011FaintContinuationDemoState(testStateConfig.faint)
    }
    if (testStateConfig?.kind === 'bs8-076-active-prevention') {
      return createBs8076ActivePreventionDemoState()
    }
    if (testStateConfig?.kind === 'support-to-trash-skill') {
      return createSupportToTrashSkillDemoState()
    }
    if (testStateConfig?.kind === 'blue-activate-skill') {
      return createBlueActivateSkillDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blue-optional-cost-attack') {
      return createBlueOptionalCostAttackDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blue-inspect-deck') {
      return createBlueInspectDeckDemoState()
    }
    if (testStateConfig?.kind === 'blue-st4-016') {
      return createBlueSt4DemoState('ST4-016')
    }
    if (testStateConfig?.kind === 'blue-st4-017') {
      return createBlueSt4DemoState('ST4-017')
    }
    if (testStateConfig?.kind === 'blue-st4-018') {
      return createBlueSt4DemoState('ST4-018')
    }
    if (testStateConfig?.kind === 'blue-st4-019') {
      return createBlueSt4DemoState('ST4-019')
    }
    if (testStateConfig?.kind === 'blue-st4-020') {
      return createBlueSt4TrapDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'card-check') {
      return createCardCheckDemoState(testStateConfig.cardNumber, {
        preferSkillSurface: testStateConfig.preferSkillSurface,
        sourceHpCount: testStateConfig.sourceHpCount,
        faintSourceMoved: testStateConfig.faintSourceMoved,
        normalAttack: testStateConfig.normalAttack,
        bs8021Scenario: testStateConfig.bs8021Scenario,
      })
    }
    if (testStateConfig?.kind === 'bs8-084-attack-discard') {
      return createBs8084AttackRequirementDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'card-negative') {
      return createCardNegativeDemoState(testStateConfig.cardNumber, {
        preferSkillSurface: testStateConfig.preferSkillSurface,
        normalAttack: testStateConfig.normalAttack,
      })
    }
    if (testStateConfig?.kind === 'bs6-079-on-play') {
      return createBs6079OnPlayDemoState(testStateConfig.blocked)
    }
    if (testStateConfig?.kind === 'bs4-026-on-play') {
      return createBs4026OnPlayDemoState(testStateConfig.blocked)
    }
    if (testStateConfig?.kind === 'bs6-031-attack-after') {
      return createBs6031AttackAfterDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'bs6-010-movement') {
      return createBs6079OnPlayDemoState(testStateConfig.blocked)
    }
    if (testStateConfig?.kind === 'bs6-008-trap') {
      return createBs6008TrapDemoState(testStateConfig.remainingHp)
    }
    if (testStateConfig?.kind === 'bs8-021-trap') {
      return createBs8021TrapDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs8-green-condition') {
      return createBs8GreenConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs4-077-timekeeper-cost') {
      return createBs4077TimekeeperCostDemoState()
    }
    if (testStateConfig?.kind === 'bs5-060-end-phase') {
      return createBs5CroissantEndPhaseDemoState(testStateConfig.supportState)
    }
    if (testStateConfig?.kind === 'p-condition') {
      return createPConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'p082-trap') {
      return createP082TrapDemoState(testStateConfig.payment)
    }
    if (testStateConfig?.kind === 'p084-item-condition') {
      return createP084ItemConditionDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'p147-special-play') {
      return createP147SpecialPlayDemoState()
    }
    if (testStateConfig?.kind === 'bs11-097-099-special-play') {
      return createBs11097To099SpecialPlayGateDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-103-104-109-inspect') {
      return createBs11103104109InspectDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-106-107-110-condition') {
      return createBs11106107110ConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-088-105-attack-then') {
      return createBs11088105AttackThenDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-088-on-play') {
      return createBs11088OnPlayDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-084-trap') {
      return createBs11084TrapDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs11-016-hp-total') {
      return createBs11016HpTotalDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-086-087-attack-then') {
      return createBs11086087AttackThenDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-111-113-special-play') {
      return createBs111113SpecialPlayDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-114-on-play') {
      return createBs11114OnPlayDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-089-on-play') {
      return createBs11089OnPlayDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-115-special-play') {
      return createBs11115SpecialPlayDemoState(
        testStateConfig.cardNumber,
        testStateConfig.negative,
        testStateConfig.supportConditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs11-116-movement-protection') {
      return createBs11116MovementProtectionDemoState()
    }
    if (testStateConfig?.kind === 'bs11-090-extra-deck') {
      return createBs11090ExtraDeckDemoState(
        testStateConfig.conditionMet, testStateConfig.sourceCardNumber, testStateConfig.extraCardNumber,
      )
    }
    if (testStateConfig?.kind === 'bs11-116-extra-deck') {
      return createBs11116ExtraDeckDemoState(
        testStateConfig.conditionMet,
        testStateConfig.cardNumber,
        testStateConfig.missingRequirement,
      )
    }
    if (testStateConfig?.kind === 'bs2-015-cost') {
      return createBs2015CostDepartureDemoState(
        testStateConfig.replacementAvailable,
      )
    }
    if (testStateConfig?.kind === 'bs3-061-condition') {
      return createBs3SilverbellConditionDemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs4-condition') {
      return createBs4ConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs4-024-target-restriction') {
      return createBs4024TargetRestrictionDemoState()
    }
    if (testStateConfig?.kind === 'bs5-flip') {
      return createBs5FlipDemoState(
        testStateConfig.cardNumber,
        testStateConfig.activate,
      )
    }
    if (testStateConfig?.kind === 'bs5-faint') {
      return createBs5FaintDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs5-trap') {
      return createBs5TrapDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs5-item-condition') {
      return createBs5ItemConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs5-stage-condition') {
      return createBs5StageConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs6-condition') {
      return createBs6ConditionDemoState(
        testStateConfig.cardNumber,
        testStateConfig.conditionMet,
      )
    }
    if (testStateConfig?.kind === 'bs5-item-111') {
      return createBs5Item111DemoState(testStateConfig.conditionMet)
    }
    if (testStateConfig?.kind === 'bs3-121-special-victory') {
      return createBs3SpecialVictoryDemoState()
    }
    if (testStateConfig?.kind === 'soul-jam-019-equipped') {
      return createSoulJamEquippedDemoState('BS3-019', 'BS3-017')
    }
    if (testStateConfig?.kind === 'soul-jam-043-equipped') {
      return createSoulJamEquippedDemoState('BS3-043', 'BS3-025')
    }
    if (testStateConfig?.kind === 'soul-jam-066-equipped') {
      return createSoulJamEquippedDemoState('BS3-066', 'BS3-055')
    }
    if (testStateConfig?.kind === 'soul-jam-091-equipped') {
      return createSoulJamEquippedDemoState('BS3-091', 'BS3-088')
    }
    if (testStateConfig?.kind === 'soul-jam-115-equipped') {
      return createSoulJamEquippedDemoState('BS3-115', 'BS3-100')
    }
    if (testStateConfig?.kind === 'soul-jam-115-protection-demo') {
      return createSoulJam115ProtectionDemoState()
    }
    return createDemoSetupGame('player-one')
  })
  const [message, setMessage] = useState(() => {
    if (testStateConfig?.kind === 'break-to-trash') {
      return testStateConfig.level === 1
        ? '測試狀態：休息區有 1 張 LV.1 餅乾。'
        : '測試狀態：休息區有 1 張 LV.2 餅乾。'
    }
    if (testStateConfig?.kind === 'replacement-choice') {
      return '測試狀態：選擇是否補餅乾。'
    }
    if (testStateConfig?.kind === 'st5-010-on-play') {
      return '測試狀態：ST5-010 補位登場後，AI 必須繼續操作。'
    }
    if (testStateConfig?.kind === 'ai-discard-reveal') {
      return '測試狀態：AI 效果棄牌公開確認。'
    }
    if (testStateConfig?.kind === 'item-usage') {
      return testStateConfig.payable
        ? '測試狀態：合法物品卡使用。'
        : '測試狀態：不合法物品卡使用（非主要階段）。'
    }
    if (testStateConfig?.kind === 'stage-usage') {
      return testStateConfig.payable
        ? '測試狀態：合法場景卡放置與啟動。'
        : '測試狀態：不合法場景卡啟動（已橫置）。'
    }
    if (testStateConfig?.kind === 'faint-damage') {
      return '測試狀態：Cherry Cookie 昏厥效果選擇目標。'
    }
    if (testStateConfig?.kind === 'trap-pretzel') {
      return testStateConfig.attack === 5
        ? '測試狀態：Pretzel Snare 可支付（攻擊 5）。'
        : '測試狀態：Pretzel Snare 不可支付（攻擊 4）。'
    }
    if (testStateConfig?.kind === 'blocker-response') {
      return testStateConfig.payable
        ? '測試狀態：Blocker 可支付（有足夠能量）。'
        : '測試狀態：Blocker 不可支付（能量不足）。'
    }
    if (testStateConfig?.kind === 'trap-and-blocker-response') {
      return testStateConfig.payable
        ? '測試狀態：陷阱與 Blocker 同時可支付，選擇回應方式。'
        : '測試狀態：陷阱與 Blocker 同時不可支付。'
    }
    if (testStateConfig?.kind === 'opponent-discard-hand') {
      return '測試狀態：Roguefort Cookie OnPlay 對手棄牌。'
    }
    if (testStateConfig?.kind === 'attack-effect') {
      return '測試狀態：Wizard Cookie 攻擊後續效果。'
    }
    if (testStateConfig?.kind === 'bs10-008-flip') {
      return `測試狀態：BS10-008 Cherry Cookie FLIP（${testStateConfig.scenario}）已由正式攻擊指令開啟，等待玩家處理。`
    }
    if (testStateConfig?.kind === 'bs10-009-hp-cost') {
      return `測試狀態：BS10-009 Cranberry Cookie HP 代價（${testStateConfig.scenario}），等待正常技能／攻擊指令。`
    }
    if (testStateConfig?.kind === 'bs11-flip') {
      return `測試狀態：${testStateConfig.cardNumber} BLACK FLIP 已由正式攻擊指令開啟，等待 FLIP ${testStateConfig.conditionMet ? '正向付款／效果' : '負向路徑'}。`
    }
    if (testStateConfig?.kind === 'bs11-twelfth-batch') {
      return `測試狀態：${testStateConfig.cardNumber} 第十二批候選卡已載入，等待${testStateConfig.conditionMet ? '正向條件／效果' : '負向條件'} Browser 驗收。`
    }
    if (testStateConfig?.kind === 'bs10-condition') {
      return `測試狀態：${testStateConfig.cardNumber} BS10 條件${testStateConfig.conditionMet ? '成立' : '不成立'}，等待正常 UI 驗收。`
    }
    if (testStateConfig?.kind === 'bs10-extra-deck') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} BS10 EXTRA 登場條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} BS10 EXTRA 登場條件不成立。`
    }
    if (testStateConfig?.kind === 'bs11-116-extra-deck') {
      if (testStateConfig.missingRequirement) {
        const failedRequirement = {
          castle: 'Dark Enchantress\'s Castle',
          break: 'Break Area LV.7',
          'special-play': '具 Special Play 的 LV.3 Dark Enchantress Cookie',
        }[testStateConfig.missingRequirement]
        return `測試狀態：BS11-116 Awaken 的 ${failedRequirement} 條件未成立，其餘條件成立。`
      }
      return testStateConfig.conditionMet
        ? '測試狀態：BS11-116 Dark Enchantress Awaken 條件成立。'
        : '測試狀態：BS11-116 Dark Enchantress Awaken 條件不成立。'
    }
    if (testStateConfig?.kind === 'bs11-097-099-special-play') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 的 Special Play Cookie 門檻成立。`
        : `測試狀態：${testStateConfig.cardNumber} 的 Special Play Cookie 門檻不成立。`
    }
    if (testStateConfig?.kind === 'bs11-103-104-109-inspect') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 正向篩選與支付條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} 反向路徑移除對應合法條件。`
    }
    if (testStateConfig?.kind === 'bs11-106-107-110-condition') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 戰鬥區條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} 戰鬥區條件不成立。`
    }
    if (testStateConfig?.kind === 'bs11-088-105-attack-then') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 攻擊後 Then 條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} 攻擊後 Then 條件不成立。`
    }
    if (testStateConfig?.kind === 'bs11-088-on-play') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} On Play 有紫色 LV.1 代價與紫色 LV.2 以上回收目標。`
        : `測試狀態：${testStateConfig.cardNumber} On Play 缺少紫色 LV.1 戰鬥區代價。`
    }
    if (testStateConfig?.kind === 'bs11-084-trap') {
      return testStateConfig.conditionMet
        ? '測試狀態：BS11-084 Trap 已完成 Refresh，攻擊後抽 1 張 Then 條件成立。'
        : '測試狀態：BS11-084 Trap 未完成 Refresh，攻擊後抽牌 Then 應不執行。'
    }
    if (testStateConfig?.kind === 'bs11-016-hp-total') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 紅色 Cookie 合計 HP 代價成立。`
        : `測試狀態：${testStateConfig.cardNumber} 紅色 Cookie 合計 HP 不足，技能應被阻擋。`
    }
    if (testStateConfig?.kind === 'bs11-086-087-attack-then') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 攻擊後跨區條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} 攻擊後跨區條件不成立。`
    }
    if (testStateConfig?.kind === 'bs11-111-113-special-play') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} Special Play／On Play 條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} Special Play 代價條件不成立。`
    }
    if (testStateConfig?.kind === 'bs11-114-on-play') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} On Play 棄牌後手牌門檻成立，可抽最多 2 張。`
        : `測試狀態：${testStateConfig.cardNumber} On Play 棄牌後手牌仍超過 5 張。`
    }
    if (testStateConfig?.kind === 'bs11-089-on-play') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} On Play 磨牌／抽牌／棄牌後，Refresh HP 條件成立。`
        : `測試狀態：${testStateConfig.cardNumber} On Play 磨牌／抽牌／棄牌可完成，但 Refresh HP 條件不成立。`
    }
    if (testStateConfig?.kind === 'bs11-115-special-play') {
      if (!testStateConfig.supportConditionMet) {
        return `測試狀態：${testStateConfig.cardNumber} 有兩張合格 Special Play 代價 Cookie，但對手支援區只有 3 張；On Play 條件未成立。`
      }
      return testStateConfig.negative
        ? `測試狀態：${testStateConfig.cardNumber} 只有一張符合條件的 Special Play Cookie，應阻擋特殊登場。`
        : `測試狀態：${testStateConfig.cardNumber} 有兩張符合條件的 Special Play Cookie，確認鈕應在選滿後啟用。`
    }
    if (testStateConfig?.kind === 'bs11-116-movement-protection') {
      return '測試狀態：BS11-116 已 Awaken；ST5-015 On Play 必須排除受保護 Cookie，並可移動另一隻合法目標。'
    }
    if (testStateConfig?.kind === 'bs11-090-extra-deck') {
      return testStateConfig.conditionMet
        ? '測試狀態：BS11-090 White Lily 可在主要階段支付自我昏厥代價，直接從 EXTRA 登場 BS11-091。'
        : '測試狀態：BS11-090 White Lily 位於非主要階段，Activate 應被阻擋。'
    }
    if (testStateConfig?.kind === 'bs8-extra-deck') {
      return testStateConfig.conditionMet
        ? `測試狀態：${testStateConfig.cardNumber} 已滿足從 EXTRA Deck 登場條件。`
        : `測試狀態：${testStateConfig.cardNumber} 尚未滿足從 EXTRA Deck 登場條件。`
    }
    if (testStateConfig?.kind === 'bs8-011-double-skill') {
      return '測試狀態：兩張 BS8-011 各自可發動一次技能；先完成一個技能後再驗證另一張。'
    }
    if (testStateConfig?.kind === 'bs8-011-faint-continuation') {
      return testStateConfig.faint
        ? '測試狀態：BS8-011 先讓 BS8-018 昏厥，再完成 BS8-018 的支付／傷害後續，最後讓 BS1-006 受到第二段傷害。'
        : '測試狀態：BS8-011 先讓 2 HP 的 BS8-018 受傷但不昏厥，再完成 BS1-006 的第二段傷害。'
    }
    if (testStateConfig?.kind === 'bs8-076-active-prevention') {
      return '測試狀態：BS8-076 目標可選擇不棄，或恰好棄 2 張手牌恢復 active。'
    }
    if (testStateConfig?.kind === 'support-to-trash-skill') {
      return '測試狀態：ST3-002 支援卡代價技能。'
    }
    if (testStateConfig?.kind === 'blue-activate-skill') {
      return testStateConfig.payable
        ? '測試狀態：Werewolf Cookie 可發動技能（手牌充足）。'
        : '測試狀態：Werewolf Cookie 不可發動技能（手牌不足）。'
    }
    if (testStateConfig?.kind === 'blue-optional-cost-attack') {
      return testStateConfig.payable
        ? '測試狀態：Captain Caviar 可支付攻擊後續效果。'
        : '測試狀態：Captain Caviar 不可支付攻擊後續效果。'
    }
    if (testStateConfig?.kind === 'blue-inspect-deck') {
      return '測試狀態：Captain Caviar OnPlay 檢視牌庫頂 3 張。'
    }
    if (testStateConfig?.kind === 'blue-st4-016') {
      return '測試狀態：ST4-016 回收我方 1 張剩餘 HP3+ 的藍色餅乾。'
    }
    if (testStateConfig?.kind === 'blue-st4-017') {
      return '測試狀態：ST4-017 回收我方 1 張 LV.1 餅乾。'
    }
    if (testStateConfig?.kind === 'blue-st4-018') {
      return '測試狀態：ST4-018 抽最多 2 張牌。'
    }
    if (testStateConfig?.kind === 'blue-st4-019') {
      return '測試狀態：ST4-019 洗回手牌並重抽相同數量。'
    }
    if (testStateConfig?.kind === 'blue-st4-020') {
      return testStateConfig.payable
        ? '測試狀態：ST4-020 選擇並棄置 2 張手牌。'
        : '測試狀態：ST4-020 手牌不足，不能發動。'
    }
    if (testStateConfig?.kind === 'card-check') {
      if (!testStateConfig.normalAttack && !testStateConfig.preferSkillSurface) {
        const cardNumber = testStateConfig.cardNumber.split('@')[0]
        if (cardNumber === 'BS9-035') return 'BS9-035：先棄手牌發動技能，再攻擊 Melon Bun Cookie；切換至防守方操作 BS9-042 補 HP FLIP。重載後不發動技能，可比較補 HP 是否被阻擋。'
        if (cardNumber === 'BS9-041') return 'BS9-041：支付 BS9-030 攻擊後代價，棄置開心果餅乾並發動 FLIP；抽牌後選對手扣 1 HP。'
        if (cardNumber === 'BS9-050') return 'BS9-050：支付三綠攻擊，再送兩張支援進棄牌區，使所有對手各受 1 傷害；接著啟動技能，重置一張橫置支援。'
      }
      return testStateConfig.preferSkillSurface
        ? `測試狀態：卡片技能 strict 檢查 ${testStateConfig.cardNumber}。`
        : `測試狀態：卡片檢查 ${testStateConfig.cardNumber}。`
    }
    if (testStateConfig?.kind === 'bs8-084-attack-discard') {
      return testStateConfig.payable
        ? 'BS8-084 正向驗證：攻擊前必須棄置 1 張手牌。'
        : 'BS8-084 反向驗證：沒有手牌時不得宣告攻擊。'
    }
    if (testStateConfig?.kind === 'bs6-010-movement') {
      return testStateConfig.blocked
        ? 'BS6-010 Timekeeper Cookie 反向驗證：阻止 BS6-079 的戰鬥區移動。'
        : 'BS6-010 Timekeeper Cookie 正向驗證：沒有阻擋者時允許 BS6-079 移動。'
    }
    if (testStateConfig?.kind === 'bs6-079-on-play') {
      return testStateConfig.blocked
        ? 'BS6-079 OnPlay 反向驗證：BS6-010 阻止戰鬥區移動。'
        : 'BS6-079 OnPlay 正向驗證：選擇目標後移動至牌庫底。'
    }
    if (testStateConfig?.kind === 'bs4-026-on-play') {
      return testStateConfig.blocked
        ? 'BS4-026 OnPlay 反向驗證：BS6-010 阻止餅乾移入休息區。'
        : 'BS4-026 OnPlay 正向驗證：選擇對手 LV.2 或以下餅乾。'
    }
    if (testStateConfig?.kind === 'bs6-031-attack-after') {
      return testStateConfig.payable
        ? 'BS6-031 攻擊後效果正向驗證：有可支付的黃色能量。'
        : 'BS6-031 攻擊後效果反向驗證：沒有可支付的黃色能量。'
    }
    if (testStateConfig?.kind === 'bs6-008-trap') {
      return testStateConfig.remainingHp === 4
        ? 'BS6-008 Sugar Swan 正向驗證：HP≤4，Tonic Spray 不可發動。'
        : 'BS6-008 Sugar Swan 反向驗證：HP=5，Tonic Spray 可進入回應。'
    }
    if (testStateConfig?.kind === 'bs8-021-trap') {
      return testStateConfig.conditionMet
        ? 'BS8-021 已裝載於 Burning Spice Cookie：休息區 LV.8，陷阱回應被禁止。'
        : 'BS8-021 已裝載於 Burning Spice Cookie：休息區 LV.7，陷阱仍可發動。'
    }
    if (testStateConfig?.kind === 'bs3-061-condition') {
      return `BS3-061 Silverbell Cookie 昏厥測試：支援區 ${testStateConfig.conditionMet ? 6 : 5} 張，支付後條件${testStateConfig.conditionMet ? '成立' : '不成立'}。`
    }
    if (testStateConfig?.kind === 'bs4-condition') {
      return `BS4 ${testStateConfig.cardNumber} 專用條件情境：${
        testStateConfig.conditionMet ? '條件成立' : '條件不成立'
      }`
    }
    if (testStateConfig?.kind === 'bs5-flip') {
      return `BS5 ${testStateConfig.cardNumber} FLIP：${
        testStateConfig.activate ? '發動效果' : '選擇不發動'
      }。`
    }
    if (testStateConfig?.kind === 'bs5-faint') {
      return `BS5 ${testStateConfig.cardNumber} 昏厥效果：${
        testStateConfig.conditionMet ? '條件成立' : '條件不成立／不可用'
      }。`
    }
    if (testStateConfig?.kind === 'bs5-trap') {
      return `BS5 ${testStateConfig.cardNumber} 陷阱：${
        testStateConfig.conditionMet ? '條件成立' : '條件不成立'
      }。`
    }
    if (testStateConfig?.kind === 'bs5-item-111') {
      return `BS5-111 覺醒!龍之怒：剩餘 HP ${testStateConfig.conditionMet ? '3 以下' : '4 以上'}。`
    }
    if (testStateConfig?.kind === 'soul-jam-019-equipped') {
      return '靈魂果醬測試：BS3-019 已裝備於 Hollyberry，攻擊力 +1。'
    }
    if (testStateConfig?.kind === 'soul-jam-043-equipped') {
      return '靈魂果醬測試：BS3-043 已裝備於 Golden Cheese，HP +2。'
    }
    if (testStateConfig?.kind === 'soul-jam-066-equipped') {
      return '靈魂果醬測試：BS3-066 已裝備，攻擊時 set-active。'
    }
    if (testStateConfig?.kind === 'soul-jam-091-equipped') {
      return '靈魂果醬測試：BS3-091 已裝備於 Pure Vanilla，攻擊時抽牌。'
    }
    if (testStateConfig?.kind === 'soul-jam-115-equipped') {
      return '靈魂果醬測試：BS3-115 已裝備於 Dark Cacao，對手效果保護。'
    }
    if (testStateConfig?.kind === 'soul-jam-115-protection-demo') {
      return '保護示範：對手 P-030（4 張藍能量），Dark Cacao（BS3-115 保護）vs Pure Vanilla（無保護）。'
    }
    return '推進階段，開始這場對戰。'
  })
  // Replay root is captured before the opening helper applies any AI/player
  // mulligan commands, so those commands are not replayed twice.
  const initialGameRef = useRef<GameState | null>(
    testStateConfig ? game : null,
  )
  const captureReplayRoot = useCallback((state: GameState) => {
    initialGameRef.current = state
  }, [])
  const setup = useMatchSetup({
    game,
    setGame,
    setMessage,
    enabled: testStateConfig === null,
    onReplayRoot: captureReplayRoot,
  })
  const {
    rpsResult,
    setupStep,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    setDeckConfig,
    selectedCustomDeck,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    resetSetup,
  } = setup
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null)
  const [selectedTrapPositionCostIds, setSelectedTrapPositionCostIds] = useState<string[]>([])
  const [selectedTrapPaymentIds, setSelectedTrapPaymentIds] = useState<string[]>([])
  const [selectedTrapCostOptionIndex, setSelectedTrapCostOptionIndex] = useState(0)
  const [selectedTrapTrashCookieToBreakAreaIds, setSelectedTrapTrashCookieToBreakAreaIds] =
    useState<string[]>([])
  const [selectedTrapHandToBreakIds, setSelectedTrapHandToBreakIds] = useState<
    string[]
  >([])
  const [selectedTrapDiscardIds, setSelectedTrapDiscardIds] = useState<
    string[]
  >([])
  const [selectedTrapTrashBattleCookieIds, setSelectedTrapTrashBattleCookieIds] =
    useState<string[]>([])
  const [trapSelectNoTarget, setTrapSelectNoTarget] = useState(false)
  const [selectedTrapTargetId, setSelectedTrapTargetId] = useState<string | null>(null)
  const [selectedTrapEffectTargets, setSelectedTrapEffectTargets] = useState<string[][]>([])
  const [selectedTrapSelfTargetId, setSelectedTrapSelfTargetId] = useState<string | null>(null)
  const [pendingResponseMode, setPendingResponseMode] = useState<
    'trap' | 'blocker' | 'attack-response' | null
  >(null)
  const [selectedTrapSupportToHandIds, setSelectedTrapSupportToHandIds] = useState<string[]>([])
  const [selectedTrapSupportTrashIds, setSelectedTrapSupportTrashIds] = useState<string[]>([])
  const [selectedTrapHandToSupportIds, setSelectedTrapHandToSupportIds] = useState<string[]>([])
  const [selectedTrapTrashToDeckIds, setSelectedTrapTrashToDeckIds] = useState<string[]>([])
  const [selectedBlockerId, setSelectedBlockerId] = useState<string | null>(null)
  const [selectedBlockerPaymentIds, setSelectedBlockerPaymentIds] = useState<string[]>([])
  const [selectedBlockerDiscardIds, setSelectedBlockerDiscardIds] = useState<string[]>([])
  const [selectedAttackResponseId, setSelectedAttackResponseId] = useState<string | null>(null)
  const [selectedAttackResponseSupportToTrashIds, setSelectedAttackResponseSupportToTrashIds] = useState<string[]>([])
  const [selectedAttackResponseTrashToDeckIds, setSelectedAttackResponseTrashToDeckIds] =
    useState<string[]>([])
  const [selectedAttackResponseDiscardIds, setSelectedAttackResponseDiscardIds] =
    useState<string[]>([])
  const [selectedFlipDiscardIds, setSelectedFlipDiscardIds] = useState<
    string[]
  >([])
  const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
    string[]
  >([])
  const [selectedFaintPaymentIds, setSelectedFaintPaymentIds] = useState<
    string[]
  >([])
  const [selectedFaintCostHandIds, setSelectedFaintCostHandIds] = useState<
    string[]
  >([])
  const [selectedFaintCostSupportIds, setSelectedFaintCostSupportIds] = useState<
    string[]
  >([])
  const [
    selectedFaintCostSupportToHandIds,
    setSelectedFaintCostSupportToHandIds,
  ] = useState<string[]>([])
  const [selectedOpponentDiscardIds, setSelectedOpponentDiscardIds] =
    useState<string[]>([])
  const [selectedOpponentDiscardPlacementById, setSelectedOpponentDiscardPlacementById] =
    useState<Record<string, 'top' | 'bottom'>>({})
  const [selectedOpponentRestSupportIds, setSelectedOpponentRestSupportIds] =
    useState<string[]>([])
  const [selectedPlaceHandHpId, setSelectedPlaceHandHpId] = useState<
    string | undefined
  >(undefined)

  // BS9-035 lets the user operate both sides of the healing witness, keeping
  // the opponent's FLIP visible instead of letting AI resolve it silently.
  // The BS9-041 attack fixture intentionally exposes the defender's FLIP
  // response in both A/B routes.  In a normal match the defender owns that
  // response; the localhost fixture switches the local control surface to
  // player-two so the revealed HP card can be activated and inspected.
  // BS12-042/043 live follow-ups likewise hand player-two the real attack;
  // when the HP reveal becomes player-one's FLIP, acting-player ownership
  // switches the local control surface back to the defender.
  const testCardBase =
    (testStateConfig?.kind === 'card-check' || testStateConfig?.kind === 'card-negative')
      ? testStateConfig.cardNumber.split('@')[0]
      : undefined
  const liveBs12FlipTestState =
    testStateConfig !== null &&
    (testStateConfig.kind === 'bs12-042' || testStateConfig.kind === 'bs12-043') &&
    String(testStateConfig.scenario) === 'follow-up-live'
  const liveBs12FlipAttackerControlsState =
    liveBs12FlipTestState && getActingPlayerId(game) === 'player-two'
  const viewerPlayerId: PlayerId =
    liveBs12FlipAttackerControlsState ||
    (testStateConfig?.kind === 'bs12-092' && game.pendingOpponentHandDiscard?.playerId === 'player-two') ||
    ((testStateConfig?.kind === 'bs12-093' || testStateConfig?.kind === 'bs12-094' || testStateConfig?.kind === 'bs12-097' || testStateConfig?.kind === 'bs12-101') && (game.pendingRefresh?.playerId === 'player-two' ||
      (game.pendingBattle?.stage === 'flip' && (game.pendingBattle.damagePlayerId ?? game.pendingBattle.defenderPlayerId) === 'player-two') ||
      (game.pendingAbilityEffect?.sourceKind === 'flip' && game.pendingAbilityEffect.playerId === 'player-two'))) ||
    (testCardBase === 'BS9-041' && testStateConfig?.kind === 'card-negative' && !testStateConfig.normalAttack) ||
    (testStateConfig?.kind === 'bs11-thirteenth-batch' &&
      testStateConfig.cardNumber === 'BS11-047' &&
      testStateConfig.scenario === 'replacement') ||
    (testCardBase === 'BS9-035' && isPlayerControllingState(game, 'player-two')) ||
    (testStateConfig?.kind === 'bs10-008-flip' && getActingPlayerId(game) === 'player-two') ||
    testStateConfig?.kind === 'bs9-041-attack' ||
    testStateConfig?.kind === 'bs9-018-kumiho' ||
    (testCardBase === 'BS9-082') ||
    (testCardBase === 'BS9-096' && testStateConfig?.kind === 'card-negative') ||
    (testCardBase === 'BS9-111' && testStateConfig?.kind === 'card-check')
    ? 'player-two'
      : 'player-one'
  const opponentId = opponentOfId(viewerPlayerId)
  const animations = useMatchAnimations(viewerPlayerId)
  const { observeTransition, enqueue, resetAnimations } = animations
  const openingHandPending = setupStep === 'deck-selection' || setupStep === 'rps' || setupStep === 'choose-order'
  const wasOpeningHandPending = useRef(openingHandPending)
  const openingDealSequence = useRef(0)
  const animationPreviousGame = useRef(game)
  useLayoutEffect(() => {
    if (openingHandPending) {
      if (animationPreviousGame.current !== game) resetAnimations()
    } else if (wasOpeningHandPending.current && setupStep === 'mulligan') {
      resetAnimations()
      enqueue(describeOpeningDeal(game, `opening-deal-${++openingDealSequence.current}`))
    } else {
      observeTransition(animationPreviousGame.current, game)
    }
    wasOpeningHandPending.current = openingHandPending
    animationPreviousGame.current = game
  }, [game, setupStep, openingHandPending, observeTransition, enqueue, resetAnimations])
  const activePlayer = game.players[game.activePlayerId]

  // 問題包（ReplayIssueBundleV1）素材：對局起點快照 + 最後一個失敗指令。
  // 首次 render 時 game 尚未套用任何 dispatch，直接當作重播起點。
  useEffect(() => {
    // Normal matches replace the pre-menu setup state when the player confirms
    // the deck/RPS flow. Capture that first mulligan state as the replay root;
    // scenario matches already set their authoritative root above.
    if (initialGameRef.current === null && setupStep === 'mulligan') {
      initialGameRef.current = game
    }
  }, [game, setupStep])
  const lastFailedCommandRef = useRef<{
    command: GameCommand
    message: string
  } | null>(null)

  const runAction: RunGameAction = (action, successMessage, onSuccess) => {
    if (animations.isBusy()) return
    try {
      const nextGame = action(game)
      setGame(nextGame)
      setMessage(successMessage)

      lastFailedCommandRef.current = null

      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  /**
   * 統一分派層：本地模式下與 runAction((current) => applyGameCommand(current, command), ...)
   * 完全等價，差別只是呼叫端直接給出 command 物件而不是包一層閉包。
   * 之後線上模式（見 useOnlineMatchController）會改成把 command 送到伺服器、
   * 不在本地套用，等伺服器回傳新狀態。
   */
  const dispatch: DispatchGameCommand = (command, successMessage, onSuccess) => {
    const commands = Array.isArray(command) ? command : [command]
    runAction(
      (current) =>
        commands.reduce((state, cmd) => {
          try {
            return applyGameCommand(state, cmd)
          } catch (error) {
            // 失敗指令不會進 commandLog，記下來供問題包重現錯誤。
            lastFailedCommandRef.current = {
              command: cmd,
              message:
                error instanceof Error ? error.message : String(error),
            }
            throw error
          }
        }, current),
      successMessage,
      onSuccess,
    )
  }
  const battleActions = useBattleActions({ game, dispatch })

  // 問題包出口：暫停選單主動回報用，也註冊給 GameErrorBoundary 崩潰時取用。
  const buildIssueBundle = useCallback(
    (errorSummary?: string | null): ReplayIssueBundleV1 => {
      const failed = lastFailedCommandRef.current
      return buildReplayIssueBundle({
        state: game,
        mode: 'offline',
        viewerId: viewerPlayerId,
        decks: {
          playerOne: deckConfig.player,
          playerTwo: deckConfig.ai,
        },
        errorSummary: errorSummary ?? failed?.message ?? null,
        failedCommand: failed?.command ?? null,
        initialState: initialGameRef.current,
      })
    },
    [game, deckConfig, viewerPlayerId],
  )

  const buildBattleReplay = useCallback(
    (ai?: BattleReplayAiMetadata) =>
      buildBattleReplayExport({
        state: game,
        mode: 'offline',
        viewerId: viewerPlayerId,
        source: testStateConfig ? 'test-state' : 'production',
        decks: {
          playerOne: deckConfig.player,
          playerTwo: deckConfig.ai,
        },
        initialState: initialGameRef.current,
        ai,
      }),
    [game, deckConfig, testStateConfig, viewerPlayerId],
  )

  useEffect(() => {
    registerIssueBundleProvider((errorSummary) =>
      buildIssueBundle(errorSummary),
    )
  }, [buildIssueBundle])

  const handleAdvancePhase = () => {
    dispatch(
      {
        kind: 'advance-phase',
        playerId: viewerPlayerId,
      },
      '階段已推進。',
    )
    battleActions.clearAttacker()
    setSelectedFaintTargetIds([])
    setSelectedFaintPaymentIds([])
    setSelectedFaintCostHandIds([])
    setSelectedFaintCostSupportIds([])
    setSelectedFaintCostSupportToHandIds([])
  }

  // Derived state
  const pendingFaint =
    game.pendingFaintEffects && game.pendingFaintEffects.length > 0
      ? game.pendingFaintEffects[0]
      : null
  const faintSourceCard = pendingFaint
    ? (() => {
        for (const player of Object.values(game.players) as PlayerState[]) {
          const found =
            player.breakArea.find(
              (cookie: CookieCard) => cookie.instanceId === pendingFaint.sourceInstanceId,
            ) ??
            player.battleArea.find(
              (cookie: CookieInBattle) =>
                cookie.card.instanceId === pendingFaint.sourceInstanceId,
            )?.card ??
            // BS8-013 moves its fainting source from Break to the discard pile
            // before its optional trash-to-battle Then is offered. Keep the
            // source card visible while that queued decision is still pending.
            player.discardPile.find(
              (card): card is CookieCard =>
                card.type === 'cookie' &&
                card.instanceId === pendingFaint.sourceInstanceId,
            )
          if (found) return found
        }
        return null
      })()
    : null
  const faintCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getFaintEffectCandidates(game)
      : []
  const faintCardCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getFaintEffectCardCandidates(game)
      : []
  const faintTargetIds = new Set(
    faintCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasFaint =
    Boolean(pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId)
  const faintMinMax = pendingFaint
    ? getFaintEffectMinMax(game, pendingFaint.effect)
    : { min: 0, max: 0 }
  const faintEnergyCost =
    pendingFaint?.sourceEnergy ??
    ((pendingFaint?.effect.kind === 'hand-to-battle' ||
      pendingFaint?.effect.kind === 'trash-to-battle')
      ? pendingFaint.effect.energyCost ?? {}
      : {})
  const faintEnergyCostTotal = getEnergyCostTotal(faintEnergyCost)
  const faintCostHandAmount = pendingFaint?.cost?.discardHand ?? 0
  const faintCostDeckToTrashAmount = pendingFaint?.cost?.deckToTrash?.amount ?? 0
  const faintCostSupportAmount = pendingFaint?.cost?.supportToTrash ?? 0
  const faintCostSupportToHandAmount = pendingFaint?.cost?.supportToHand ?? 0
  const faintOptional = pendingFaint?.optional === true
  const faintCostHandCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getDiscardHandCostCandidates(
          pendingFaint.cost ?? {},
          game.players[viewerPlayerId].hand,
          pendingFaint.sourceInstanceId,
        )
      : []
  const faintCostSupportCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId &&
    faintCostSupportAmount > 0
      ? getSupportEffectCandidates(game, pendingFaint.context)
          .filter(
            (support) =>
              !selectedFaintPaymentIds.includes(support.card.instanceId) &&
              !selectedFaintCostSupportToHandIds.includes(
                support.card.instanceId,
              ),
          )
          .map((support) => support.card)
      : []
  const faintCostSupportToHandCandidates =
    pendingFaint &&
    pendingFaint.sourcePlayerId === viewerPlayerId &&
    faintCostSupportToHandAmount > 0
      ? getSupportEffectCandidates(game, pendingFaint.context)
          .filter(
            (support) =>
              !selectedFaintPaymentIds.includes(support.card.instanceId) &&
              !selectedFaintCostSupportIds.includes(support.card.instanceId) &&
              (!pendingFaint.cost ||
                isSupportToHandCostCandidate(pendingFaint.cost, support)),
          )
          .map((support) => support.card)
      : []
  const faintPaymentCandidates =
    pendingFaint &&
    pendingFaint.sourcePlayerId === viewerPlayerId &&
    faintEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea
          .filter((support) => {
            if (support.rested) return false
            if (selectedFaintPaymentIds.includes(support.card.instanceId)) {
              return true
            }
            if (selectedFaintPaymentIds.length >= faintEnergyCostTotal) {
              return false
            }
            return isEnergyColorCompatibleWithCost(
              faintEnergyCost,
              support.card.energyColor,
            )
          })
          .map((support) => support.card)
      : []
  const faintPaymentValid =
    faintEnergyCostTotal === 0 ||
    validateEnergyPayment(
      faintEnergyCost,
      game.players[viewerPlayerId].supportArea,
      selectedFaintPaymentIds,
    ).valid
  const toggleFaintPayment = (instanceId: string) => {
    if (faintEnergyCostTotal === 0) return
    setSelectedFaintPaymentIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= faintEnergyCostTotal) return current
      if (!faintPaymentCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const toggleFaintCostHand = (instanceId: string) => {
    if (faintCostHandAmount === 0) return
    setSelectedFaintCostHandIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= faintCostHandAmount) return current
      if (!faintCostHandCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const toggleFaintCostSupport = (instanceId: string) => {
    if (faintCostSupportAmount === 0) return
    setSelectedFaintCostSupportIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= faintCostSupportAmount) return current
      if (!faintCostSupportCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const currentPendingDecision = getPendingDecision(game)

  const [selectedAfterDamageTargetIds, setSelectedAfterDamageTargetIds] =
    useState<string[]>([])
  const pendingAfterDamage =
    game.pendingAfterDamageEffects && game.pendingAfterDamageEffects.length > 0
      ? game.pendingAfterDamageEffects[0]
      : null
  const afterDamageSourceCard = getAfterDamageEffectSourceCard(game)
  const afterDamageCandidates =
    pendingAfterDamage &&
    pendingAfterDamage.sourcePlayerId === viewerPlayerId
      ? getAfterDamageEffectCandidates(game)
      : []
  const afterDamageTargetIds = new Set(
    afterDamageCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasAfterDamage =
    Boolean(
      pendingAfterDamage &&
      pendingAfterDamage.sourcePlayerId === viewerPlayerId &&
      currentPendingDecision?.kind === 'after-damage-effect',
    )
  const afterDamageMinMax = pendingAfterDamage
    ? getAfterDamageEffectMinMax(pendingAfterDamage.effect)
    : { min: 0, max: 0 }

  const playerTrapCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getTrapCandidates(game, viewerPlayerId)
      : []
  const selectedTrap = playerTrapCandidates.find(
    (card) => card.instanceId === selectedTrapId,
  )
  const trapCostOptions = selectedTrap?.trap
    ? getTrapCostOptions(selectedTrap.trap, game, viewerPlayerId)
    : []
  const selectedTrapCost =
    trapCostOptions[selectedTrapCostOptionIndex] ?? selectedTrap?.trap?.cost
  const trapEnergyCost =
    selectedTrapCost?.energy ?? selectedTrapCost ?? {}
  const trapEnergyCostTotal = getEnergyCostTotal(trapEnergyCost)
  const trapPaymentCandidates =
    trapEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea.filter((support) => {
          if (support.rested) return false
          return isEnergyColorCompatibleWithCost(
            trapEnergyCost,
            support.card.energyColor,
          )
        })
      : []
  const trapPaymentTargetIds = new Set(
    trapEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea
          .filter((support) => {
            if (support.rested) return false
            if (selectedTrapPaymentIds.includes(support.card.instanceId))
              return true
            if (selectedTrapPaymentIds.length >= trapEnergyCostTotal)
              return false
            return isEnergyColorCompatibleWithCost(
              trapEnergyCost,
              support.card.energyColor,
            )
          })
          .map((support) => support.card.instanceId)
      : [],
  )
  const trapPaymentValid =
    trapEnergyCostTotal > 0
      ? validateEnergyPayment(
          trapEnergyCost,
          game.players[viewerPlayerId].supportArea,
          selectedTrapPaymentIds,
        ).valid
      : true
  const toggleTrapPayment = (instanceId: string) => {
    setSelectedTrapPaymentIds((current) => {
      const isSelected = current.includes(instanceId)
      if (!isSelected) {
        if (current.length >= trapEnergyCostTotal) return current
        const supportCard = game.players[viewerPlayerId].supportArea.find(
          (s) => s.card.instanceId === instanceId,
        )
        if (!supportCard) return current
        if (
          !isEnergyColorCompatibleWithCost(
            trapEnergyCost,
            supportCard.card.energyColor,
          )
        )
          return current
      }
      return isSelected
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId]
    })
  }
  const selectedTrapDiscardCost = selectedTrapCost?.discardHand ?? 0
  const selectedTrapPositionCost = selectedTrapCost?.battleCookiePosition
  const selectedTrapPositionCostCandidates = getBattleCookiePositionCostCandidates(selectedTrapCost ?? {}, game.players[viewerPlayerId].battleArea, selectedTrapId ?? undefined)
  const selectedTrapTrashBattleCookieCost =
    selectedTrapCost?.trashBattleCookie?.count ?? 0
  const selectedTrapTrashBattleCookieCandidates = selectedTrapCost
    ? getTrashBattleCookieCostCandidates(
        selectedTrapCost,
        game.players[viewerPlayerId].battleArea,
      )
    : []
  const selectedTrapHandToBreakCost =
    selectedTrapCost?.handToBreakArea?.count ?? 0
  const selectedTrapHandToBreakCandidates = selectedTrap
    ? game.players[viewerPlayerId].hand.filter(
        (card) =>
          card.instanceId !== selectedTrap.instanceId &&
          card.type === 'cookie' &&
          (!selectedTrapCost?.handToBreakArea?.energyColor ||
            card.energyColor ===
              selectedTrapCost.handToBreakArea.energyColor),
      )
    : []
  const selectedTrapDiscardCandidates = selectedTrap
    ? getDiscardHandCostCandidates(
        selectedTrapCost ?? {},
        game.players[viewerPlayerId].hand,
        selectedTrap.instanceId,
      )
    : []
  const selectedTrapTrashCookieToBreakAreaAmount =
    selectedTrapCost?.trashCookieToBreakArea?.count ?? 0
  const selectedTrapTrashCookieToBreakAreaCandidates = selectedTrapCost
    ? getTrashCookieToBreakAreaCostCandidates(
        selectedTrapCost,
        game.players[viewerPlayerId].discardPile,
      )
    : []
  const trapCostOptionLabels = trapCostOptions.map((_, index) =>
    index === 0 ? '卡面主支付：能量' : '替代支付：棄牌區 1 HP 餅乾→休息區',
  )
  const selectTrapCostOption = (index: number) => {
    if (index < 0 || index >= trapCostOptions.length) return
    setSelectedTrapPositionCostIds([])
    setSelectedTrapCostOptionIndex(index)
    setSelectedTrapPaymentIds([])
    setSelectedTrapTrashCookieToBreakAreaIds([])
  }
  const toggleFaintCostSupportToHand = (instanceId: string) => {
    if (faintCostSupportToHandAmount === 0) return
    setSelectedFaintCostSupportToHandIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= faintCostSupportToHandAmount) return current
      if (
        !faintCostSupportToHandCandidates.some(
          (card) => card.instanceId === instanceId,
        )
      ) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const trapAllowEmptyTarget =
    selectedTrap?.trap?.effects.some(
      (effect) =>
        (effect.kind === 'damage' ||
          effect.kind === 'damage-by-break-count' ||
          effect.kind === 'modify-attack' ||
          effect.kind === 'modify-attack-by-break-count' ||
          effect.kind === 'prevent-knockout') &&
        (effect.target.min ?? 0) === 0,
    ) ?? false
  // 陷阱目標：優先使用玩家手動選擇；若未選擇則自動挑選當前攻擊者。
  // 否則對手有多隻餅乾時，減攻擊／防昏厥類陷阱會套用到非攻擊者身上，
  // 導致玩家發動陷阱卻沒能減少實際攻擊傷害（看起來像「效果沒發動」）。
  const trapTargetCandidates =
    selectedTrap && !trapSelectNoTarget
      ? getTrapTargetCandidates(game, viewerPlayerId, selectedTrap.instanceId)
      : []
  const attackerInstanceId = game.pendingBattle?.attackerInstanceId ?? null
  const selectedTrapTarget = selectedTrapTargetId
    ? trapTargetCandidates.find(
        (candidate) => candidate.card.instanceId === selectedTrapTargetId,
      )
    : attackerInstanceId
      ? trapTargetCandidates.find(
          (candidate) => candidate.card.instanceId === attackerInstanceId,
        )
      : undefined
  const selectedTrapTargets = selectedTrapTarget
    ? [selectedTrapTarget]
    : trapTargetCandidates.slice(0, 1)
  const trapEffectTargetContext = selectedTrap
    ? {
        sourcePlayerId: viewerPlayerId,
        sourceInstanceId: selectedTrap.instanceId,
        sourceCardName: selectedTrap.name,
      }
    : null
  /**
   * Keep target candidates aligned with the original effect index.  A trap
   * may contain two independent target effects (BS5-109); sharing the legacy
   * targetIds list would make both effects hit the same Cookie.
   */
  const trapEffectTargetSteps =
    selectedTrap?.trap && trapEffectTargetContext
      ? selectedTrap.trap.effects.flatMap((effect, effectIndex) => {
          if (
            (!requiresTargetSelection(effect) && !requiresEffectCardSelection(effect)) ||
            !isEffectConditionMet(game, trapEffectTargetContext, effect)
          ) {
            return []
          }
          // support-to-hp with selectTarget is a paired selection: the
          // player must choose one legal Cookie and one matching support card
          // together.  Keep both card types in the same per-effect step so
          // the trap command can pass the exact ordered pair to the rules
          // engine.  Other targeted effects still expose battle Cookies only.
          const candidates =
            effect.kind === 'support-to-hp' && effect.selectTarget
              ? getEffectSelectionCandidates(
                  game,
                  trapEffectTargetContext,
                  effect,
                ).map((card) => ({
                  card,
                  hpCards: [],
                  rested: false,
                }))
              : requiresTargetSelection(effect)
                ? getEffectTargetCandidatesForEffect(
                    game,
                    trapEffectTargetContext,
                    effect,
                  )
                : getEffectSelectionCandidates(
                    game,
                    trapEffectTargetContext,
                    effect,
                  ).map((card) => ({
                    card,
                    hpCards: [],
                    rested: false,
                  }))
          if (candidates.length === 0) return []
          const limits = getEffectTargetSelectionLimits(effect)
          const ordered = effect.kind === 'damage-all' && effect.sequential === true
          return [
            {
              effectIndex,
              candidates,
              selectedTargetIds: selectedTrapEffectTargets[effectIndex] ?? [],
              ordered,
              min: ordered ? candidates.length : limits?.min ?? 0,
              max: ordered ? candidates.length : limits?.max ?? 1,
              allowEmpty: !ordered && (limits?.min ?? 0) === 0,
            },
          ]
        })
      : []
  const selectTrapEffectTarget = (effectIndex: number, instanceId: string) => {
    const step = trapEffectTargetSteps.find(
      (candidate) => candidate.effectIndex === effectIndex,
    )
    const max = step?.max ?? 1
    setSelectedTrapEffectTargets((current) => {
      const next = current.map((ids) => [...ids])
      const selected = next[effectIndex] ?? []
      if (selected.includes(instanceId)) {
        next[effectIndex] = selected.filter((id) => id !== instanceId)
      } else if (max === 1) {
        next[effectIndex] = [instanceId]
      } else if (selected.length < max) {
        next[effectIndex] = [...selected, instanceId]
      }
      return next
    })
  }
  const skipTrapEffectTarget = (effectIndex: number) => {
    setSelectedTrapEffectTargets((current) => {
      const next = current.map((ids) => [...ids])
      next[effectIndex] = []
      return next
    })
  }
  // Targeted trap effects are now represented by the per-effect steps above,
  // including self-side targets.  Do not expose the legacy self-target phase
  // for the same effect or the UI will show a duplicate step whose selection
  // is ignored when `effectTargets` is submitted (BS6-020).
  const hasPerEffectSelfTargetSelection = trapEffectTargetSteps.some((step) => {
    const effect = selectedTrap?.trap?.effects[step.effectIndex]
    return Boolean(
      effect &&
        'target' in effect &&
        effect.target?.side === 'self',
    )
  })
  const trapSelfTargetCandidates =
    selectedTrap && !hasPerEffectSelfTargetSelection
      ? getTrapSelfTargetCandidates(game, viewerPlayerId, selectedTrap.instanceId)
      : []
  const selectedTrapSelfTarget = selectedTrapSelfTargetId
    ? trapSelfTargetCandidates.find(
        (candidate) => candidate.card.instanceId === selectedTrapSelfTargetId,
      )
    : undefined
  const trapSelfTargetRequired =
    !hasPerEffectSelfTargetSelection &&
    (selectedTrap?.trap?.effects.some(
      (effect) =>
        ((effect.kind === 'damage' ||
          effect.kind === 'gain-hp' ||
          effect.kind === 'hp-to-hand') &&
          'target' in effect &&
          effect.target?.side === 'self' &&
          (effect.target.min ?? 0) > 0) ||
        (effect.kind === 'transfer-hp' &&
          effect.receiverTarget?.side === 'self' &&
          (effect.receiverTarget.min ?? 0) > 0),
    ) ?? false)
  const selectedTrapSelfTargets = selectedTrapSelfTarget
    ? [selectedTrapSelfTarget]
    : trapSelfTargetRequired
      ? trapSelfTargetCandidates.slice(0, 1)
      : []
  const trapSupportTrashEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'support-to-trash',
  )
  const trapSupportTrashAmount =
    trapSupportTrashEffect?.kind === 'support-to-trash'
      ? trapSupportTrashEffect.amount
      : 0
  const trapSupportTrashCandidates =
    trapSupportTrashAmount > 0
      ? game.players[viewerPlayerId].supportArea.map(
          (support: SupportCard) => support.card,
        )
      : []

  const trapSupportToHandEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'support-to-hand',
  )
  const trapSupportToHandAmount =
    trapSupportToHandEffect?.kind === 'support-to-hand'
      ? trapSupportToHandEffect.amount
      : 0
  const trapSupportToHandCandidates =
    trapSupportToHandAmount > 0
      ? game.players[viewerPlayerId].supportArea.map(
          (support: SupportCard) => support.card,
        )
      : []

  const trapHandToSupportEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'hand-to-support',
  )
  const trapHandToSupportAmount =
    trapHandToSupportEffect?.kind === 'hand-to-support'
      ? trapHandToSupportEffect.amount
      : 0
  const trapHandToSupportCandidates =
    trapHandToSupportAmount > 0
      ? game.players[viewerPlayerId].hand.filter(
          (card) => card.instanceId !== selectedTrap?.instanceId,
        )
      : []

  const trapTrashToDeckEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'trash-to-deck',
  )
  const trapTrashToDeckAmount =
    trapTrashToDeckEffect?.kind === 'trash-to-deck'
      ? trapTrashToDeckEffect.max
      : 0
  const trapTrashToDeckCandidates =
    trapTrashToDeckEffect?.kind === 'trash-to-deck' && selectedTrap
      ? getTrashToDeckCandidates(
          game,
          { sourcePlayerId: viewerPlayerId, sourceInstanceId: selectedTrap.instanceId },
          trapTrashToDeckEffect,
        )
      : []

  const toggleTrapSupportToHand = useCallback(
    (id: string) => {
      setSelectedTrapSupportToHandIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapSupportToHandAmount
            ? [...current, id]
            : current,
      )
    },
    [trapSupportToHandAmount],
  )

  const toggleTrapSupportTrash = useCallback(
    (id: string) => {
      if (
        !game.players[viewerPlayerId].supportArea.some(
          (support) => support.card.instanceId === id,
        )
      ) {
        return
      }
      setSelectedTrapSupportTrashIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapSupportTrashAmount
            ? [...current, id]
            : current,
      )
    },
    [game, trapSupportTrashAmount, viewerPlayerId],
  )

  const toggleTrapHandToSupport = useCallback(
    (id: string) => {
      setSelectedTrapHandToSupportIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapHandToSupportAmount
            ? [...current, id]
            : current,
      )
    },
    [trapHandToSupportAmount],
  )

  const toggleTrapTrashToDeck = useCallback(
    (id: string) => {
      setSelectedTrapTrashToDeckIds((current) =>
        current.includes(id)
          ? current.filter((cId) => cId !== id)
          : current.length < trapTrashToDeckAmount
            ? [...current, id]
            : current,
      )
    },
    [trapTrashToDeckAmount],
  )

  const playerBlockerCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getBlockerCandidates(game, viewerPlayerId)
      : []
  const selectedBlocker = playerBlockerCandidates.find(
    (cookie) => cookie.card.instanceId === selectedBlockerId,
  )
  const blockerEnergyCost = selectedBlocker?.card.skill
    ? selectedBlocker.card.skill.cost.energy ?? selectedBlocker.card.skill.cost
    : {}
  const blockerEnergyCostTotal = getEnergyCostTotal(blockerEnergyCost)
  const blockerPaymentCandidates =
    blockerEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea
          .filter((support) => {
            if (support.rested) return false
            if (selectedBlockerPaymentIds.includes(support.card.instanceId)) {
              return true
            }
            if (selectedBlockerPaymentIds.length >= blockerEnergyCostTotal) {
              return false
            }
            return isEnergyColorCompatibleWithCost(
              blockerEnergyCost,
              support.card.energyColor,
            )
          })
          .map((support) => support.card)
      : []
  const blockerPaymentValidation =
    blockerEnergyCostTotal === 0
      ? { valid: true, reason: '不需支付能量。' }
      : validateEnergyPayment(
          blockerEnergyCost,
          game.players[viewerPlayerId].supportArea,
          selectedBlockerPaymentIds,
        )
  const blockerPaymentValid = blockerPaymentValidation.valid
  const toggleBlockerPayment = (instanceId: string) => {
    if (blockerEnergyCostTotal === 0) return
    setSelectedBlockerPaymentIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= blockerEnergyCostTotal) return current
      if (!blockerPaymentCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }

  const playerAttackResponseCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getAttackResponseSkillCandidates(game, viewerPlayerId)
      : []
  const selectedAttackResponse = playerAttackResponseCandidates.find(
    (cookie) => cookie.card.instanceId === selectedAttackResponseId,
  )
  const attackResponseCost = selectedAttackResponse?.card.skill?.cost ?? {}
  const attackResponseSupportToTrashAmount = attackResponseCost.supportToTrash ?? 0
  const attackResponseSupportToTrashCandidates = selectedAttackResponse
    ? getSupportEffectCandidates(game, { sourcePlayerId: viewerPlayerId, sourceInstanceId: selectedAttackResponse.card.instanceId }, { side: 'self', keyword: attackResponseCost.supportToTrashKeyword }).map(entry => entry.card)
    : []
  const toggleAttackResponseSupportToTrash = (instanceId: string) => {
    if (!attackResponseSupportToTrashCandidates.some(card => card.instanceId === instanceId)) return
    setSelectedAttackResponseSupportToTrashIds(current => current.includes(instanceId)
      ? current.filter(id => id !== instanceId)
      : current.length < attackResponseSupportToTrashAmount ? [...current, instanceId] : current)
  }
  const attackResponseTrashToDeckAmount =
    attackResponseCost.trashToDeck?.count ?? 0
  const attackResponseTrashToDeckCandidates =
    attackResponseCost.trashToDeck
      ? getTrashToDeckCostCandidates(
          attackResponseCost,
          game.players[viewerPlayerId].discardPile,
        )
      : []
  const attackResponseDiscardAmount = attackResponseCost.discardHand ?? 0
  const attackResponseDiscardCandidates = selectedAttackResponse
    ? getDiscardHandCostCandidates(
        attackResponseCost,
        game.players[viewerPlayerId].hand,
        selectedAttackResponse.card.instanceId,
      )
    : []
  const toggleAttackResponseTrashToDeck = (instanceId: string) => {
    if (
      !attackResponseTrashToDeckCandidates.some(
        (card) => card.instanceId === instanceId,
      )
    ) {
      return
    }
    setSelectedAttackResponseTrashToDeckIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < attackResponseTrashToDeckAmount
          ? [...current, instanceId]
          : current,
    )
  }
  const toggleAttackResponseDiscard = (instanceId: string) => {
    if (
      !attackResponseDiscardCandidates.some(
        (card) => card.instanceId === instanceId,
      )
    ) {
      return
    }
    setSelectedAttackResponseDiscardIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < attackResponseDiscardAmount
          ? [...current, instanceId]
          : current,
    )
  }

  const replacementTask = getCurrentReplacementTask(game)

  const aiControlsCurrentState: boolean =
    (testStateConfig?.kind === 'bs12-005' && !['positive', 'enable'].includes(testStateConfig.scenario)) ||
    testStateConfig?.kind === 'bs12-006' ||
    (testStateConfig?.kind === 'bs12-007' && testStateConfig.scenario === 'opponent-turn') ||
    (testStateConfig?.kind === 'bs12-008' && testStateConfig.scenario === 'opponent-turn') ||
    testStateConfig?.kind === 'bs12-009' ||
    testStateConfig?.kind === 'bs12-027' ||
    testStateConfig?.kind === 'bs12-029' ||
    testStateConfig?.kind === 'bs12-047' ||
    testStateConfig?.kind === 'bs12-049' ||
    testStateConfig?.kind === 'bs12-050' ||
    (testStateConfig?.kind === 'bs12-051' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-052' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-053' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-054' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-055' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-056' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-057' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-058' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-059' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-060' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-063' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-062' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-064' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-065' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-066' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-067' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-068' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-069' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-070' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-071' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-072' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-073' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-074' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-075' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-076' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-077' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-078' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-079' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-061' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-030' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-031' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-032' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-033' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-034' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-035' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-036' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-037' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-038' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-039' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-041' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-042' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-080' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-081' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-082' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-083' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-084' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-085' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-086' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-087' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-flip' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip')) ||
    (testStateConfig?.kind === 'bs12-105' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || !!game.pendingRefresh || !!game.pendingReplacement)) ||
    (testStateConfig?.kind === 'bs12-final' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || !!game.pendingRefresh || !!game.pendingReplacement)) ||
    (testStateConfig?.kind === 'bs12-tail' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || !!game.pendingRefresh || !!game.pendingReplacement)) ||
    (testStateConfig?.kind === 'bs12-088' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-090' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-091' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-092' && (!hasBlockingPending(game) || !!game.pendingOpponentHandDiscard)) ||
    (testStateConfig?.kind === 'bs12-093' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-094' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-095' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-096' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-098' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-099' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-100' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-101' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh || !!game.pendingReplacement || !!game.pendingFaintEffects?.length)) ||
    (testStateConfig?.kind === 'bs12-097' && (!hasBlockingPending(game) || game.pendingBattle?.stage === 'flip' || game.pendingAbilityEffect?.sourceKind === 'flip' || !!game.pendingRefresh)) ||
    (testStateConfig?.kind === 'bs12-089' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-043' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-044' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-048' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-045' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-046' && !hasBlockingPending(game)) ||
    (testStateConfig?.kind === 'bs12-040' && !hasBlockingPending(game)) ||
    testStateConfig?.kind === 'bs12-028' ||
    testStateConfig?.kind === 'bs12-010' ||
    testStateConfig?.kind === 'bs12-011' ||
    testStateConfig?.kind === 'bs12-012' ||
    (testStateConfig?.kind === 'bs12-013' && !hasBlockingPending(game)) ||
    ((testStateConfig?.kind === 'bs12-014' || testStateConfig?.kind === 'bs12-015' || testStateConfig?.kind === 'bs12-016' || testStateConfig?.kind === 'bs12-017' || testStateConfig?.kind === 'bs12-018' || testStateConfig?.kind === 'bs12-019' || testStateConfig?.kind === 'bs12-020' || testStateConfig?.kind === 'bs12-021' || testStateConfig?.kind === 'bs12-022' || testStateConfig?.kind === 'bs12-023' || testStateConfig?.kind === 'bs12-024' || testStateConfig?.kind === 'bs12-025' || testStateConfig?.kind === 'bs12-026') && !hasBlockingPending(game)) ||
    testStateConfig?.kind === 'bs10-008-flip' ||
    (testStateConfig?.kind === 'bs11-flip' || testStateConfig?.kind === 'bs11-071-hp-no-flip') ||
    testStateConfig?.kind === 'bs11-twelfth-batch' ||
    (testStateConfig?.kind === 'bs11-thirteenth-batch' &&
      testStateConfig.cardNumber === 'BS11-047' &&
      testStateConfig.scenario === 'replacement') ||
    (testCardBase === 'BS9-041' && testStateConfig?.kind === 'card-negative' && !testStateConfig.normalAttack) ||
    testCardBase === 'BS9-035' ||
    testStateConfig?.kind === 'bs9-041-attack' ||
    testStateConfig?.kind === 'bs9-018-kumiho' ||
    (testStateConfig?.kind === 'bs9-candidate' &&
      ['BS9-031', 'BS9-032'].includes(testStateConfig.cardNumber.split('@')[0])) ||
    ((testStateConfig?.kind === 'card-check' || testStateConfig?.kind === 'card-negative') &&
      (['BS9-077', 'BS9-081', 'BS9-082', 'BS9-096', 'BS9-100', 'BS9-111'].includes(testStateConfig.cardNumber.split('@')[0]) ||
        (testStateConfig.cardNumber.split('@')[0] === 'BS10-003' && testStateConfig.normalAttack === undefined)))
      ? false
      : isPlayerControllingState(game, 'player-two')

  const pendingPlayerId = getPendingChoicePlayerId(game, replacementTask)
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer
      ? getReplacementCandidates(game, pendingPlayer.id)
      : []

  const holdExtraEntryPhase = testStateConfig?.kind === 'bs12-092' && testStateConfig.scenario === 'outside-main'
  useEffect(() => {
    if (
      holdExtraEntryPhase ||
      setupStep ||
      game.status !== 'playing' ||
      game.activePlayerId !== viewerPlayerId ||
      (game.phase !== 'active' && game.phase !== 'draw') ||
      hasBlockingPending(game)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (
          current.activePlayerId !== viewerPlayerId ||
          (current.phase !== 'active' && current.phase !== 'draw')
        ) {
          return current
        }
        return applyGameCommand(current, {
          kind: 'advance-phase',
          playerId: viewerPlayerId,
        })
      })
      setMessage(
        game.phase === 'active'
          ? '活躍動作已自動完成。'
          : '抽牌已自動完成，進入支援階段。',
      )
    }, 350)

    return () => window.clearTimeout(timer)
  }, [game, setupStep, viewerPlayerId, holdExtraEntryPhase])

  // auto-skip trap
  useEffect(() => {
    const battle = game.pendingBattle
    const allowCandidateOpponentTrapSkip =
      testStateConfig?.kind === 'bs11-twelfth-batch' &&
      (testStateConfig.cardNumber === 'BS11-043' ||
        testStateConfig.cardNumber === 'BS11-044')
    const trapControllerId =
      allowCandidateOpponentTrapSkip && battle?.stage === 'trap'
        ? battle.defenderPlayerId
        : viewerPlayerId
    // Card-check test states normally auto-finish the attack after a trap is
    // played. A trap Then effect may create a real pending decision first
    // (for example BS5-087's draw up to 2), so wait until that decision is
    // resolved. When the local attacker has a printed attack-after effect,
    // or an effect-damage sequence, advance one damage command at a time;
    // resolve-battle would auto-skip HP FLIPs/faint triggers or auto-pick a
    // later target, hiding the decisions this fixture is meant to verify.
    // Production matches never use this shortcut.
    if (
      testStateConfig &&
      battle?.stage === 'damage' &&
      !getPendingDecision(game) &&
      !game.pendingRefresh &&
      game.pendingAbilityEffect?.sourceKind !== 'flip'
    ) {
      const timer = window.setTimeout(() => {
        setGame((current) => {
          if (
            current.pendingBattle?.stage !== 'damage' ||
            getPendingDecision(current) ||
            current.pendingRefresh ||
            current.pendingAbilityEffect?.sourceKind === 'flip'
          ) {
            return current
          }
          const preserveHumanDamageDecisions =
            testStateConfig.kind === 'bs12-flip' ||
            testStateConfig.kind === 'bs12-105' ||
            testStateConfig.kind === 'bs12-final' ||
            testStateConfig.kind === 'bs12-tail' ||
            testStateConfig.kind === 'bs12-088' ||
            testStateConfig.kind === 'bs12-089' ||
            ((testStateConfig.kind === 'bs12-042' || testStateConfig.kind === 'bs12-043') &&
              testStateConfig.scenario === 'follow-up-live') ||
            testStateConfig.kind === 'bs12-090' ||
            testStateConfig.kind === 'bs12-091' ||
            testStateConfig.kind === 'bs12-092' ||
            testStateConfig.kind === 'bs12-093' ||
            testStateConfig.kind === 'bs12-094' ||
            testStateConfig.kind === 'bs12-095' ||
            testStateConfig.kind === 'bs12-096' ||
            testStateConfig.kind === 'bs12-098' ||
            testStateConfig.kind === 'bs12-099' ||
            testStateConfig.kind === 'bs12-100' ||
            testStateConfig.kind === 'bs12-101' ||
            testStateConfig.kind === 'bs12-097' ||
            testStateConfig.kind === 'bs12-032' ||
            testStateConfig.kind === 'bs12-033' ||
            testStateConfig.kind === 'bs12-034' ||
            testStateConfig.kind === 'bs12-035' ||
            testStateConfig.kind === 'bs12-036' ||
            testStateConfig.kind === 'bs12-037' ||
            testStateConfig.kind === 'bs12-038' ||
            (testStateConfig.kind === 'bs12-007' && testStateConfig.scenario !== 'blocked') || testStateConfig.kind === 'bs12-009' || testStateConfig.kind === 'bs12-010' || testStateConfig.kind === 'bs12-027' || testStateConfig.kind === 'bs12-029' || testStateConfig.kind === 'bs12-047' || testStateConfig.kind === 'bs12-049' || testStateConfig.kind === 'bs12-050' || testStateConfig.kind === 'bs12-051' ||
            testStateConfig.kind === 'bs10-008-flip' ||
            testStateConfig.kind === 'bs11-flip' ||
            testStateConfig.kind === 'bs11-071-hp-no-flip' ||
            ((testStateConfig.kind === 'card-check' || testStateConfig.kind === 'card-negative') &&
              testStateConfig.cardNumber.split('@')[0] === 'BS9-035') ||
            Boolean(current.pendingBattle.effectDamageSequence) ||
            (current.pendingBattle.attackerPlayerId === viewerPlayerId &&
              current.pendingBattle.attackEffects.length > 0)
          return applyGameCommand(current, {
            ...(preserveHumanDamageDecisions
              ? {
                  kind: 'resolve-next-damage' as const,
                  playerId:
                    current.pendingBattle.damagePlayerId ??
                    current.pendingBattle.defenderPlayerId,
                }
              : {
                  kind: 'resolve-battle' as const,
                  playerId: viewerPlayerId,
                }),
          })
        })
      }, 0)

      return () => window.clearTimeout(timer)
    }

    if (
      battle?.stage !== 'trap' ||
      // 陷阱已經打出去了（例如 BS3-093），戰鬥還停在 'trap' 階段只是為了等玩家
      // 確認 reveal-top-deck 的巢狀效果——getTrapCandidates 在 trapUsed 之後
      // 一律回傳空陣列，不代表「沒有陷阱可用該自動略過」，若不排除這種情況會
      // 對著一個待處理決策再送一次 skip-trap，被規則層的 assertNoPendingDecision
      // 擋下拋錯，把整個 App 炸掉。
      battle.trapUsed ||
      (battle.defenderPlayerId !== viewerPlayerId &&
        !allowCandidateOpponentTrapSkip) ||
      // 陷阱被卡牌效果禁止時，要先讓防守方看見原因並確認；不能悄悄
      // 自動略過，否則線上對手只會誤以為手牌中的陷阱沒有被讀到。
      battle.trapsDisabled ||
      // A nested decision owns the turn. It must reach its own UI before the
      // response window can be closed automatically.
      game.pendingAbilityEffect ||
      getPendingDecision(game) ||
      getTrapCandidates(game, trapControllerId).length > 0 ||
      getBlockerCandidates(game, trapControllerId).length > 0 ||
      getAttackResponseSkillCandidates(game, trapControllerId).length > 0
    ) {
      return
    }

    // 只在「所有已知關卡都通過、卻還是進不了候選名單」時示警。手上有陷阱卡
    // 但付不出代價／條件未成立是日常狀況（被攻擊時支援卡通常還橫置著），
    // 每次都印會把主控台灌滿假警報，真的出問題時反而看不見。
    const unexplainedTraps = explainUnavailableTraps(
      game,
      trapControllerId,
    ).filter((entry) => entry.reason === 'unknown')
    if (unexplainedTraps.length > 0) {
      console.warn(
        '[auto-skip-trap] 陷阱卡通過所有已知可用性檢查卻仍不在候選名單，即將自動略過。診斷資訊：',
        {
          traps: unexplainedTraps,
          breakArea: game.players[trapControllerId].breakArea.map(
            (c) => ({ id: c.id, level: c.level }),
          ),
          supportArea: game.players[trapControllerId].supportArea.map(
            (s) => ({ id: s.card.id, energyColor: s.card.energyColor, rested: s.rested }),
          ),
          declaredDamage: battle.declaredDamage,
        },
      )
    }

    // Do not route this mandatory transition through a zero-delay timer. A
    // separate render can cancel that timer while the attack is still pending,
    // leaving a live AI attack with no legal control on screen. A microtask is
    // scheduled after this committed effect but cannot be cancelled by its
    // cleanup; the current-state guard keeps nested decisions untouched.
    queueMicrotask(() => {
      setSelectedTrapPositionCostIds([])
      setSelectedTrapId(null)
      setSelectedTrapCostOptionIndex(0)
      setSelectedTrapTrashCookieToBreakAreaIds([])
      setSelectedTrapDiscardIds([])
      setSelectedTrapTargetId(null)
      setSelectedTrapSelfTargetId(null)
      setGame((current: GameState) => {
        const currentBattle = current.pendingBattle
        const currentTrapControllerId =
          allowCandidateOpponentTrapSkip && currentBattle?.stage === 'trap'
            ? currentBattle.defenderPlayerId
            : viewerPlayerId
        if (
          currentBattle?.stage !== 'trap' ||
          currentBattle.trapUsed ||
          (currentBattle.defenderPlayerId !== viewerPlayerId &&
            !allowCandidateOpponentTrapSkip) ||
          currentBattle.trapsDisabled ||
          current.pendingAbilityEffect ||
          getPendingDecision(current) ||
          getTrapCandidates(current, currentTrapControllerId).length > 0 ||
          getBlockerCandidates(current, currentTrapControllerId).length > 0 ||
          getAttackResponseSkillCandidates(current, currentTrapControllerId)
            .length > 0
        ) {
          return current
        }
        return applyGameCommand(current, {
          kind: 'skip-trap',
          playerId: currentTrapControllerId,
        })
      })
    })
  }, [game, testStateConfig, viewerPlayerId])

  // resetMatchState: resets all match-owned state (used by App's resetGame)
  const resetMatchState = useCallback(
    (nextConfig: { player: DeckChoice; ai: BuiltInDeckChoice }) => {
      const nextGame = createDemoSetupGame('player-one', nextConfig)
      initialGameRef.current = nextGame
      lastFailedCommandRef.current = null
      setGame(nextGame)
      resetSetup()
      battleActions.clearAttacker()
      setSelectedFaintTargetIds([])
      setSelectedFaintPaymentIds([])
      animations.resetAnimations()
      setSelectedTrapPositionCostIds([])
      setSelectedTrapId(null)
      setSelectedTrapCostOptionIndex(0)
      setSelectedTrapTrashCookieToBreakAreaIds([])
      setSelectedTrapDiscardIds([])
      setTrapSelectNoTarget(false)
      setSelectedTrapEffectTargets([])
      setPendingResponseMode(null)
      setSelectedFlipDiscardIds([])
      setSelectedOpponentDiscardIds([])
      setSelectedOpponentDiscardPlacementById({})
      setSelectedOpponentRestSupportIds([])
      setSelectedBlockerId(null)
      setSelectedBlockerPaymentIds([])
      setSelectedAttackResponseId(null)
      setSelectedAttackResponseTrashToDeckIds([])
      setSelectedAttackResponseDiscardIds([])
      setSelectedAttackResponseSupportToTrashIds([])
    },
    [animations, battleActions, resetSetup],
  )

  // loadScenarioState: loads a player-configured test scenario, skipping opening setup
  const loadScenarioState = useCallback(
    (scenarioState: GameState, scenarioMessage: string) => {
      initialGameRef.current = scenarioState
      lastFailedCommandRef.current = null
      setGame(scenarioState)
      setSetupStep(null)
      setMessage(scenarioMessage)
      battleActions.clearAttacker()
      setSelectedFaintTargetIds([])
      setSelectedFaintPaymentIds([])
      animations.resetAnimations()
      setSelectedTrapPositionCostIds([])
      setSelectedTrapId(null)
      setSelectedTrapCostOptionIndex(0)
      setSelectedTrapTrashCookieToBreakAreaIds([])
      setSelectedTrapDiscardIds([])
      setTrapSelectNoTarget(false)
      setSelectedTrapEffectTargets([])
      setPendingResponseMode(null)
      setSelectedFlipDiscardIds([])
      setSelectedOpponentDiscardIds([])
      setSelectedOpponentDiscardPlacementById({})
      setSelectedOpponentRestSupportIds([])
      setSelectedBlockerId(null)
      setSelectedBlockerPaymentIds([])
      setSelectedAttackResponseId(null)
      setSelectedAttackResponseTrashToDeckIds([])
      setSelectedAttackResponseDiscardIds([])
      setSelectedAttackResponseSupportToTrashIds([])
    },
    [animations, battleActions, setSetupStep],
  )

  return {
    game,
    setGame,
    rpsResult,
    setupStep,
    openingHandPending,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    selectedCustomDeck,
    setDeckConfig,
    selectedAttackerId: battleActions.selectedAttackerId,
    setSelectedAttackerId: battleActions.setSelectedAttackerId,
    selectedAttackPaymentIds: battleActions.selectedAttackPaymentIds,
    setSelectedAttackPaymentIds: battleActions.setSelectedAttackPaymentIds,
    message,
    setMessage,
    buildBattleReplay,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    dispatch,
    handleAdvancePhase,
    handleAttackTarget: battleActions.handleAttackTarget,
    toggleAttackPayment: battleActions.toggleAttackPayment,
    attackPaymentTargetIds: battleActions.attackPaymentTargetIds,
    clearAttacker: battleActions.clearAttacker,
    activePlayer,
    viewerPlayerId,
    opponentId,
    selectedAttacker: battleActions.selectedAttacker,
    selectedAttackCost: battleActions.selectedAttackCost,
    attackPaymentValidation: battleActions.attackPaymentValidation,
    // Trap
    selectedTrapId,
    setSelectedTrapId,
    selectedTrapCostOptionIndex,
    selectTrapCostOption,
    trapCostOptionLabels,
    selectedTrapTrashCookieToBreakAreaIds,
    setSelectedTrapTrashCookieToBreakAreaIds,
    selectedTrapTrashCookieToBreakAreaAmount,
    selectedTrapTrashCookieToBreakAreaCandidates,
    selectedTrapDiscardIds,
    setSelectedTrapDiscardIds,
    selectedTrapTrashBattleCookieIds,
    selectedTrapPositionCostIds, setSelectedTrapPositionCostIds, selectedTrapPositionCost, selectedTrapPositionCostCandidates,
    setSelectedTrapTrashBattleCookieIds,
    trapSelectNoTarget,
    setTrapSelectNoTarget,
    playerTrapCandidates,
    selectedTrap,
    selectedTrapPaymentIds,
    setSelectedTrapPaymentIds,
    trapPaymentCandidates,
    trapPaymentTargetIds,
    trapPaymentValid,
    trapEnergyCostTotal,
    toggleTrapPayment,
    selectedTrapDiscardCost,
    selectedTrapDiscardCandidates,
    selectedTrapHandToBreakIds,
    setSelectedTrapHandToBreakIds,
    selectedTrapHandToBreakCost,
    selectedTrapHandToBreakCandidates,
    selectedTrapTrashBattleCookieCost,
    selectedTrapTrashBattleCookieCandidates,
    trapAllowEmptyTarget,
    trapTargetCandidates,
    trapEffectTargetSteps,
    selectedTrapEffectTargets,
    setSelectedTrapEffectTargets,
    selectTrapEffectTarget,
    skipTrapEffectTarget,
    attackerInstanceId,
    selectedTrapTargetId,
    setSelectedTrapTargetId,
    selectedTrapTargets,
    trapSelfTargetCandidates,
    trapSelfTargetRequired,
    selectedTrapSelfTargetId,
    setSelectedTrapSelfTargetId,
    selectedTrapSelfTargets,
    selectedTrapSupportTrashIds,
    setSelectedTrapSupportTrashIds,
    trapSupportTrashCandidates,
    trapSupportTrashAmount,
    toggleTrapSupportTrash,
    selectedTrapSupportToHandIds,
    setSelectedTrapSupportToHandIds,
    trapSupportToHandCandidates,
    trapSupportToHandAmount,
    toggleTrapSupportToHand,
    selectedTrapHandToSupportIds,
    setSelectedTrapHandToSupportIds,
    trapHandToSupportCandidates,
    trapHandToSupportAmount,
    toggleTrapHandToSupport,
    selectedTrapTrashToDeckIds,
    setSelectedTrapTrashToDeckIds,
    trapTrashToDeckCandidates,
    trapTrashToDeckAmount,
    toggleTrapTrashToDeck,
    // Blocker
    selectedBlockerId,
    setSelectedBlockerId,
    selectedBlockerPaymentIds,
    setSelectedBlockerPaymentIds,
    selectedBlockerDiscardIds,
    setSelectedBlockerDiscardIds,
    blockerEnergyCost,
    blockerEnergyCostTotal,
    blockerPaymentCandidates,
    blockerPaymentValid,
    blockerPaymentValidationReason: blockerPaymentValidation.reason,
    toggleBlockerPayment,
    playerBlockerCandidates,
    pendingResponseMode,
    setPendingResponseMode,
    playerAttackResponseCandidates,
    selectedAttackResponseId,
    setSelectedAttackResponseId,
    selectedAttackResponseTrashToDeckIds,
    setSelectedAttackResponseTrashToDeckIds,
    attackResponseTrashToDeckCandidates,
    attackResponseTrashToDeckAmount,
    toggleAttackResponseTrashToDeck,
    selectedAttackResponseDiscardIds,
    setSelectedAttackResponseDiscardIds,
    attackResponseDiscardCandidates,
    attackResponseDiscardAmount,
    toggleAttackResponseDiscard,
    selectedAttackResponseSupportToTrashIds,
    setSelectedAttackResponseSupportToTrashIds,
    attackResponseSupportToTrashCandidates,
    attackResponseSupportToTrashAmount,
    toggleAttackResponseSupportToTrash,
    // Flip
    selectedFlipDiscardIds,
    setSelectedFlipDiscardIds,
    // Faint (raw hasFaint without !pendingEffect check)
    selectedFaintTargetIds,
    setSelectedFaintTargetIds,
    selectedFaintPaymentIds,
    setSelectedFaintPaymentIds,
    selectedFaintCostHandIds,
    setSelectedFaintCostHandIds,
    selectedFaintCostSupportIds,
    setSelectedFaintCostSupportIds,
    selectedFaintCostSupportToHandIds,
    setSelectedFaintCostSupportToHandIds,
    faintEnergyCost,
    faintEnergyCostTotal,
    faintPaymentCandidates,
    faintPaymentValid,
    toggleFaintPayment,
    faintCostHandAmount,
    faintCostDeckToTrashAmount,
    faintCostHandCandidates,
    toggleFaintCostHand,
    faintCostSupportAmount,
    faintCostSupportCandidates,
    toggleFaintCostSupport,
    faintCostSupportToHandAmount,
    faintCostSupportToHandCandidates,
    toggleFaintCostSupportToHand,
    faintOptional,
    pendingFaint,
    faintSourceCard,
    faintCandidates,
    faintCardCandidates,
    faintCandidateLabel: getFaintEffectCandidateLabel(game),
    faintTargetIds,
    hasFaint,
    faintMin: faintMinMax.min,
    faintMax: faintMinMax.max,
    // After-damage
    selectedAfterDamageTargetIds,
    setSelectedAfterDamageTargetIds,
    pendingAfterDamage,
    afterDamageSourceCard,
    afterDamageCandidates,
    afterDamageTargetIds,
    hasAfterDamage,
    afterDamageMin: afterDamageMinMax.min,
    afterDamageMax: afterDamageMinMax.max,
    // Opponent discard
    selectedOpponentDiscardIds,
    setSelectedOpponentDiscardIds,
    selectedOpponentDiscardPlacementById,
    setSelectedOpponentDiscardPlacementById,
    // Opponent rest support (BS5-065 Petrification)
    selectedOpponentRestSupportIds,
    setSelectedOpponentRestSupportIds,
    // Place hand HP (兩階段選擇第二階段)
    selectedPlaceHandHpId,
    setSelectedPlaceHandHpId,
    animations,
    // Animation
    attackShakeId: animations.attackShakeId,
    damageFlashId: animations.damageFlashId,
    faintAnimIds: animations.faintAnimIds,
    drawAnimIds: animations.drawAnimIds,
    // Derived
    pendingPlayer,
    pendingOptions,
    aiControlsCurrentState,
    replacementTask,
    // Reset
    resetMatchState,
    loadScenarioState,
    buildIssueBundle,
  } as const
}
