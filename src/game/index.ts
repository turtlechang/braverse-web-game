export { GameRuleError } from './errors'
export {
  executeCardEffect,
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectTargeted,
  isEffectUntargeted,
  selectEffectTargets,
  validateBreakToTrashTargets,
} from './effects'
export { createDemoGame, createDemoSetupGame } from './demo'
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
  getTrapCandidates,
  getTrapTargetCandidates,
  playTrap,
  resolveBattleAutomatically,
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
export { getRefreshCandidates, refreshDeck } from './refresh'
export {
  createGame,
  drawMulliganCompensation,
  forceMulliganOpeningHand,
  keepOpeningHand,
  mulliganOpeningHand,
  selectStartingCookie,
} from './setup'
export { advancePhase, canAttack, TURN_PHASES } from './turn'
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
