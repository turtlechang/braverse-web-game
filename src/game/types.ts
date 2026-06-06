export type PlayerId = 'player-one' | 'player-two'

export type CardType = 'cookie' | 'item' | 'trap' | 'stage'

export interface BaseCard {
  id: string
  instanceId: string
  name: string
}

export interface CookieCard extends BaseCard {
  type: 'cookie'
  level: number
  hp: number
  attack: number
  attackCost: number
}

export interface NonCookieCard extends BaseCard {
  type: Exclude<CardType, 'cookie'>
}

export type GameCard = CookieCard | NonCookieCard

export interface CookieInBattle {
  card: CookieCard
  hpCards: GameCard[]
  rested: boolean
}

export type EffectTargetSide = 'self' | 'opponent'

export interface EffectTargetSelector {
  side: EffectTargetSide
  min: number
  max: number
  excludeSource?: boolean
  remainingHp?: number
  minLevel?: number
}

export interface BreakLevelCondition {
  kind: 'break-level-at-least'
  level: number
}

export type EffectCondition = BreakLevelCondition

export interface DamageEffect {
  kind: 'damage'
  amount: number
  target: EffectTargetSelector
  condition?: EffectCondition
}

export type EffectDuration =
  | 'this-turn'
  | 'opponent-next-turn'
  | 'persistent'

export interface ModifyAttackEffect {
  kind: 'modify-attack'
  amount: number
  duration: EffectDuration
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface ModifyDamageReceivedEffect {
  kind: 'modify-damage-received'
  amount: number
  duration: EffectDuration
  target: EffectTargetSelector
  condition?: EffectCondition
}

export type CardEffect =
  | DamageEffect
  | ModifyAttackEffect
  | ModifyDamageReceivedEffect

export interface AttackModifier {
  sourceInstanceId: string
  targetInstanceId: string
  amount: number
  expiresAfterTurn: number | null
}

export interface DamageReceivedModifier {
  sourceInstanceId: string
  targetInstanceId: string
  amount: number
  expiresAfterTurn: number | null
}

export interface EffectContext {
  sourcePlayerId: PlayerId
  sourceInstanceId: string
}

export interface SupportCard {
  card: GameCard
  rested: boolean
}

export interface PlayerState {
  id: PlayerId
  name: string
  deck: GameCard[]
  hand: GameCard[]
  battleArea: CookieInBattle[]
  supportArea: SupportCard[]
  breakArea: CookieCard[]
  discardPile: GameCard[]
  stage: GameCard | null
  hasMulliganed: boolean
  startingCookieSelected: boolean
}

export type TurnPhase = 'active' | 'draw' | 'support' | 'main' | 'end'

export type GameStatus = 'setup' | 'playing' | 'finished'

export type DefeatReason =
  | 'break-level-limit'
  | 'no-cookie-available'
  | 'refresh-unavailable'

export interface GameResult {
  winnerId: PlayerId
  loserId: PlayerId
  reason: DefeatReason
}

export interface GameState {
  players: Record<PlayerId, PlayerState>
  firstPlayerId: PlayerId
  activePlayerId: PlayerId
  turnNumber: number
  phase: TurnPhase
  status: GameStatus
  result: GameResult | null
  supportPlacedThisTurn: boolean
  attackModifiers: AttackModifier[]
  damageReceivedModifiers: DamageReceivedModifier[]
  pendingReplacementPlayerId: PlayerId | null
  pendingRefresh: {
    playerId: PlayerId
    remainingDraws: number
  } | null
}

export interface PlayerSetup {
  id: PlayerId
  name: string
  deck: GameCard[]
}

export type Shuffle = (cards: GameCard[]) => GameCard[]
