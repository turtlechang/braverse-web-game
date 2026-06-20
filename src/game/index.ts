export { GameRuleError } from './errors'
export {
  executeCardEffect,
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTrashCookieCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectTargeted,
  isEffectUntargeted,
  resolveOpponentHandDiscard,
  resolveInspectDeck,
  selectEffectTargets,
  validateBreakToTrashTargets,
} from './effects'
export {
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createDemoGame,
  createDemoSetupGame,
  createItemUsageDemoState,
  createStageUsageDemoState,
} from './demo'
export type { DeckConfig } from './demo'
export { createSeededShuffle } from './helpers'
export {
  getAttackEnergyCost,
  getEnergyCostTotal,
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
export type { EnergyPaymentValidation } from './energy'
export {
  createOfficialBlueStarterDeck,
  createOfficialGreenStarterDeck,
  createOfficialPurpleStarterDeck,
  createOfficialRedStarterDeck,
  createOfficialStarterDeck,
  createOfficialYellowStarterDeck,
  DECK_CREATORS,
  OFFICIAL_BLUE_STARTER_DECK,
  OFFICIAL_DECK_RECIPES,
  OFFICIAL_GREEN_STARTER_DECK,
  OFFICIAL_PURPLE_STARTER_DECK,
  OFFICIAL_RED_STARTER_DECK,
  OFFICIAL_STARTER_DECK_RED,
  OFFICIAL_YELLOW_STARTER_DECK,
} from './starter-deck'
export type { DeckChoice, StarterDeckEntry } from './starter-deck'
export { chooseRandomDeck } from './opening'
export {
  selectAiEnergyPayment,
  simulateAiMatch,
  takeAiStep,
} from './ai'
export {
  beginAttack,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  getTrapCandidates,
  getTrapTargetCandidates,
  playTrap,
  resolveAttackEffect,
  resolveBattleAutomatically,
  resolveFaintEffect,
  resolveFlip,
  resolveNextDamage,
  resolveOptionalCostAttack,
  skipTrap,
} from './battle'
export type { PlayTrapOptions, ResolveFlipOptions } from './battle'
export {
  attackCookie,
  deployCookie,
  placeSupportCard,
  replaceDefeatedCookie,
  skipDefeatedCookieReplacement,
} from './actions'
export {
  activateStage,
  canActivateStage,
  canPlayItem,
  canPlayStage,
  getItemAbility,
  getStageAbility,
  playItem,
  playStage,
} from './card-abilities'
export { getRefreshCandidates, refreshDeck } from './refresh'
export { hasBlockingPending } from './pending'
export { getActingPlayerId, isPlayerControllingState } from './controller'
export {
  createGame,
  drawMulliganCompensation,
  forceMulliganOpeningHand,
  keepOpeningHand,
  mulliganOpeningHand,
  selectStartingCookie,
} from './setup'
export { advancePhase, canAttack, processEndPhaseEffects, TURN_PHASES } from './turn'
export {
  activateCookieSkill,
  canActivateCookieSkill,
  canPayEnergyCost,
  skipCookieOnPlay,
} from './skills'
export {
  evaluateBasicVictory,
  evaluateBreakLevelVictory,
  finishWithDefeat,
  getBasicDefeatReason,
  getBreakAreaLevel,
  resolveBasicVictory,
  resolveBreakLevelVictory,
} from './victory'
export {
  continuePendingReplacements,
  finalizePendingReplacements,
  getCurrentReplacementTask,
  getReplacementCandidates,
  recordCookieDepartures,
} from './replacement'
export type {
  AttackModifier,
  AbilityCost,
  CardAbility,
  BaseCard,
  BreakLevelCondition,
  BreakToTrashEffect,
  CardEffect,
  CardSkill,
  CardType,
  CookieCard,
  CookieInBattle,
  DamageEffect,
  DamageReceivedModifier,
  DeckToSupportEffect,
  DefeatReason,
  DrawEffect,
  EffectCondition,
  EffectContext,
  EffectDuration,
  EffectTargetSelector,
  EffectTargetSide,
  EnergyColor,
  EnergyCost,
  GameCard,
  GameResult,
  GameState,
  GameStatus,
  FlipAbility,
  GainHpEffect,
  ModifyAttackEffect,
  ModifyDamageReceivedEffect,
  NonCookieCard,
  OpponentBattleToTrashEffect,
  OpponentDiscardHandEffect,
  OpponentRandomDiscardEffect,
  PendingFaintEffect,
  PendingOpponentHandDiscard,
  PlayerId,
  PlayerSetup,
  PlayerState,
  PendingBattle,
  PendingBattleStage,
  PendingReplacement,
  PreventKnockoutEffect,
  ReplacementTask,
  ReturnToHandEffect,
  SetActiveEffect,
  Shuffle,
  SkillTrigger,
  SupportCard,
  StageAbility,
  StageCard,
  SupportToTrashEffect,
  TargetedCardEffect,
  TrapAbility,
  TrapCondition,
  TurnPhase,
} from './types'
export {
  applyGameCommand,
  getPendingDecision,
} from './commands'
export type {
  FaintEffectDecision,
  GameCommand,
  InspectDeckDecision,
  OpponentHandDiscardDecision,
  OptionalCostAttackDecision,
  PendingDecision,
  ResolveFaintEffectCommand,
  ResolveInspectDeckCommand,
  ResolveOpponentHandDiscardCommand,
  ResolveOptionalCostAttackCommand,
} from './commands'
export type {
  AiActionType,
  AiDecision,
  AiEffectSelection,
  AiMatchMetrics,
  AiMatchResult,
} from './ai'
