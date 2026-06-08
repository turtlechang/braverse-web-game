export { GameRuleError } from './errors'
export {
  executeCardEffect,
  getAttackDamageAgainst,
  getEffectTargetCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  selectEffectTargets,
} from './effects'
export { createDemoGame } from './demo'
export { createSeededShuffle } from './helpers'
export {
  getAttackEnergyCost,
  getEnergyCostTotal,
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
export type { EnergyPaymentValidation } from './energy'
export {
  createOfficialRedStarterDeck,
  createOfficialStarterDeck,
  createOfficialYellowStarterDeck,
  OFFICIAL_RED_STARTER_DECK,
  OFFICIAL_STARTER_DECK_RED,
  OFFICIAL_YELLOW_STARTER_DECK,
} from './starter-deck'
export type { StarterDeckEntry } from './starter-deck'
export {
  selectAiEnergyPayment,
  simulateAiMatch,
  takeAiStep,
} from './ai'
export {
  attackCookie,
  deployCookie,
  placeSupportCard,
  replaceDefeatedCookie,
} from './actions'
export { getRefreshCandidates, refreshDeck } from './refresh'
export { createGame, mulliganOpeningHand, selectStartingCookie } from './setup'
export { advancePhase, canAttack, TURN_PHASES } from './turn'
export {
  activateCookieSkill,
  canActivateCookieSkill,
  canPayEnergyCost,
} from './skills'
export {
  evaluateBasicVictory,
  finishWithDefeat,
  getBasicDefeatReason,
  getBreakAreaLevel,
  resolveBasicVictory,
} from './victory'
export type {
  AttackModifier,
  BaseCard,
  BreakLevelCondition,
  CardEffect,
  CardSkill,
  CardType,
  CookieCard,
  CookieInBattle,
  DamageEffect,
  DamageReceivedModifier,
  DefeatReason,
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
  ModifyAttackEffect,
  ModifyDamageReceivedEffect,
  NonCookieCard,
  PlayerId,
  PlayerSetup,
  PlayerState,
  Shuffle,
  SkillTrigger,
  SupportCard,
  TurnPhase,
} from './types'
export type {
  AiActionType,
  AiDecision,
  AiEffectSelection,
  AiMatchMetrics,
  AiMatchResult,
} from './ai'
