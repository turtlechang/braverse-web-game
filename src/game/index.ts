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
  selectEffectTargets,
  validateBreakToTrashTargets,
} from './effects'
export {
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
  createOfficialGreenStarterDeck,
  createOfficialRedStarterDeck,
  createOfficialStarterDeck,
  createOfficialYellowStarterDeck,
  DECK_CREATORS,
  OFFICIAL_DECK_RECIPES,
  OFFICIAL_GREEN_STARTER_DECK,
  OFFICIAL_RED_STARTER_DECK,
  OFFICIAL_STARTER_DECK_RED,
  OFFICIAL_YELLOW_STARTER_DECK,
} from './starter-deck'
export type { DeckChoice, StarterDeckEntry } from './starter-deck'
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
  resolveBattleAutomatically,
  resolveFaintEffect,
  resolveFlip,
  resolveNextDamage,
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
  OpponentDiscardHandEffect,
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
export type {
  AiActionType,
  AiDecision,
  AiEffectSelection,
  AiMatchMetrics,
  AiMatchResult,
} from './ai'
