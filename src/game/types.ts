export type PlayerId = 'player-one' | 'player-two'

export type CardType = 'cookie' | 'item' | 'trap' | 'stage'
export type OfficialRuntimeCardType =
  | 'cookie'
  | 'item'
  | 'trap'
  | 'stage'
  | 'flip'

export type EnergyColor =
  | 'red'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'black'

export type EnergyCost = Partial<Record<EnergyColor | 'neutral', number>>

export type SkillTrigger = 'activate' | 'on-play' | 'passive' | 'block'

export interface CardSkill {
  trigger: SkillTrigger
  oncePerTurn: boolean
  yourTurn: boolean
  restSource: boolean
  cost: AbilityCost
  text: string
  effects: CardEffect[]
  faint?: boolean
  endPhase?: boolean
  afterDamage?: boolean
}

export interface CardAbility {
  cost: AbilityCost
  text: string
  effects: CardEffect[]
}

export interface StageAbility extends CardAbility {
  placementCost: EnergyCost
  restSource: boolean
  triggered?: boolean
}

export interface BaseCard {
  id: string
  instanceId: string
  name: string
  imageUrl?: string
  energyColor?: EnergyColor | 'wild'
  effectText?: string
  effects?: CardEffect[]
  skill?: CardSkill
  officialType?: OfficialRuntimeCardType
  flip?: FlipAbility
  trap?: TrapAbility
  item?: CardAbility
  stageAbility?: StageAbility
}

export interface CookieCard extends BaseCard {
  type: 'cookie'
  level: number
  hp: number
  attack: number
  attackCost: number
  attackEnergyCost?: EnergyCost
  attackText?: string
  attackEffects?: CardEffect[]
}

export interface NonCookieCard extends BaseCard {
  type: Exclude<CardType, 'cookie'>
}

export type GameCard = CookieCard | NonCookieCard

export interface CookieInBattle {
  card: CookieCard
  hpCards: GameCard[]
  rested: boolean
  battleEntryId?: string
}

export type EffectTargetSide = 'self' | 'opponent'

export interface EffectTargetSelector {
  side: EffectTargetSide
  min: number
  max: number
  excludeSource?: boolean
  sourceOnly?: boolean
  remainingHp?: number
  minRemainingHp?: number
  minLevel?: number
  maxLevel?: number
  energyColor?: EnergyColor
}

export interface BreakLevelCondition {
  kind: 'break-level-at-least'
  level: number
}

export interface OpponentTrashCountAtLeastCondition {
  kind: 'opponent-trash-count-at-least'
  count: number
}

export interface SupportCountAtLeastCondition {
  kind: 'support-count-at-least'
  count: number
}

export interface HandCountAtMostCondition {
  kind: 'hand-count-at-most'
  count: number
}

export interface SupportAreaDecreasedThisTurnCondition {
  kind: 'support-area-decreased-this-turn'
}

export interface OpponentHasCookieWithLevelCondition {
  kind: 'opponent-has-cookie-with-level'
  level: number
}

export type EffectCondition =
  | BreakLevelCondition
  | OpponentTrashCountAtLeastCondition
  | SupportCountAtLeastCondition
  | HandCountAtMostCondition
  | SupportAreaDecreasedThisTurnCondition
  | OpponentHasCookieWithLevelCondition

export interface DamageEffect {
  kind: 'damage'
  amount: number
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface DamageAllEffect {
  kind: 'damage-all'
  amount: number
  side: EffectTargetSide
  condition?: EffectCondition
}

export interface DamageByBreakCountEffect {
  kind: 'damage-by-break-count'
  target: EffectTargetSelector
  perCount: number
  minBreakLevel?: number
  breakEnergyColor?: EnergyColor
  condition?: EffectCondition
}

export interface ModifyAttackByBreakCountEffect {
  kind: 'modify-attack-by-break-count'
  target: EffectTargetSelector
  duration: EffectDuration
  perCount: number
  minBreakLevel?: number
  exactBreakLevel?: number
  breakEnergyColor?: EnergyColor
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

export interface DrawEffect {
  kind: 'draw'
  amount: number
  condition?: EffectCondition
}

export interface DrawUpToEffect {
  kind: 'draw-up-to'
  max: number
  condition?: EffectCondition
}

export interface HandToDeckAndDrawEffect {
  kind: 'hand-to-deck-and-draw'
}

export interface DeckToSupportEffect {
  kind: 'deck-to-support'
  amount: number
  rested?: boolean
  condition?: EffectCondition
}

export interface BreakToTrashEffect {
  kind: 'break-to-trash'
  max: number
  exactLevel: number
  condition?: EffectCondition
}

export interface GainHpEffect {
  kind: 'gain-hp'
  amount: number
  target?: EffectTargetSelector
  condition?: EffectCondition
}

export interface PreventKnockoutEffect {
  kind: 'prevent-knockout'
  target: EffectTargetSelector
}

export interface RedirectAttackEffect {
  kind: 'redirect-attack'
  target: EffectTargetSelector
}

export interface PlaceSourceToSupportEffect {
  kind: 'place-source-to-support'
  rested?: boolean
}

export interface SupportToTrashEffect {
  kind: 'support-to-trash'
  amount: number
}

export interface DisableFlipEffect {
  kind: 'disable-flip'
  duration: 'this-turn'
  target: EffectTargetSelector
}

export interface DisableBlockEffect {
  kind: 'disable-block'
  duration: 'this-turn'
  side: 'opponent'
}

export interface ViewHpEffect {
  kind: 'view-hp'
  target: EffectTargetSelector
  optional?: boolean
}

export interface ModifyAllAttackEffect {
  kind: 'modify-all-attack'
  amount: number
  duration: EffectDuration
  side: EffectTargetSide
  condition?: EffectCondition
}

export interface BattleToSupportEffect {
  kind: 'battle-to-support'
  target: EffectTargetSelector
}

export interface TrashToBattleEffect {
  kind: 'trash-to-battle'
  amount: number
}

export interface SupportToHandEffect {
  kind: 'support-to-hand'
  amount: number
  maxLevel?: number
  condition?: EffectCondition
}

export interface OpponentDiscardHandEffect {
  kind: 'opponent-discard-hand'
  count: number
}

export interface DiscardHandEffect {
  kind: 'discard-hand'
  count: number
  condition?: EffectCondition
}

export interface OpponentBattleToTrashEffect {
  kind: 'opponent-battle-to-trash'
  maxLevel?: number
  minLevel?: number
  remainingHp?: number
}

export interface FieldToTrashEffect {
  kind: 'field-to-trash'
  target: EffectTargetSelector
  allowStage?: boolean
  stageOnly?: boolean
  stageLevel?: number
  condition?: EffectCondition
}

export interface SetActiveEffect {
  kind: 'set-active'
  supportCount: number
  condition?: EffectCondition
}

export interface InspectDeckEffect {
  kind: 'inspect-deck'
  lookCount: number
  pickCount: number
  restToBottom: true
  filterColor?: EnergyColor
}

export interface OptionalCostAttackEffect {
  kind: 'optional-cost-attack'
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
}

export interface ReturnToHandEffect {
  kind: 'return-to-hand'
  target: EffectTargetSelector
}

export interface ReturnToDeckBottomEffect {
  kind: 'return-to-deck-bottom'
  target: EffectTargetSelector
}

export interface OpponentRandomDiscardEffect {
  kind: 'opponent-random-discard'
  count: number
}

export interface HpToTrashEffect {
  kind: 'hp-to-trash'
  amount: number
  target: EffectTargetSelector
}

export interface TrashToSupportEffect {
  kind: 'trash-to-support'
  amount: number
  rested?: boolean
}

export type CardEffect =
  | DamageEffect
  | DamageAllEffect
  | DamageByBreakCountEffect
  | ModifyAttackByBreakCountEffect
  | ModifyAttackEffect
  | ModifyDamageReceivedEffect
  | DrawEffect
  | DrawUpToEffect
  | HandToDeckAndDrawEffect
  | DeckToSupportEffect
  | BreakToTrashEffect
  | GainHpEffect
  | PreventKnockoutEffect
  | RedirectAttackEffect
  | PlaceSourceToSupportEffect
  | SupportToTrashEffect
  | DisableFlipEffect
  | DisableBlockEffect
  | ViewHpEffect
  | ModifyAllAttackEffect
  | BattleToSupportEffect
  | TrashToBattleEffect
  | SupportToHandEffect
  | OpponentDiscardHandEffect
  | DiscardHandEffect
  | OpponentBattleToTrashEffect
  | FieldToTrashEffect
  | ReturnToHandEffect
  | ReturnToDeckBottomEffect
  | OpponentRandomDiscardEffect
  | HpToTrashEffect
  | TrashToSupportEffect
  | SetActiveEffect
  | InspectDeckEffect
  | OptionalCostAttackEffect

export type TargetedCardEffect =
  | DamageEffect
  | DamageByBreakCountEffect
  | ModifyAttackByBreakCountEffect
  | ModifyAttackEffect
  | ModifyDamageReceivedEffect
  | PreventKnockoutEffect
  | DisableFlipEffect
  | ViewHpEffect
  | BattleToSupportEffect
  | ReturnToHandEffect
  | ReturnToDeckBottomEffect
  | FieldToTrashEffect
  | RedirectAttackEffect
  | HpToTrashEffect

export type AbilityCost = EnergyCost & {
  energy?: EnergyCost
  discardHand?: number
  discardHandColor?: EnergyColor
  supportToTrash?: number
  supportToHand?: number
  hpToTrash?: {
    amount?: number
    untilRemainingHp?: number
  }
  trashBattleCookie?: {
      count: number
      level?: number
      energyColor?: EnergyColor
    }
}

export interface FlipAbility {
  text: string
  cost: AbilityCost
  effects: CardEffect[]
}

export type TrapCondition =
  | {
      kind: 'break-level-at-least'
      level: number
    }
  | {
      kind: 'attacker-attack-more-than'
      amount: number
    }
  | {
      kind: 'friendly-color-fainted-this-battle'
      color: EnergyColor
    }
  | {
      kind: 'self-cookie-hp-equals'
      amount: number
    }
  | {
      kind: 'opponent-trash-count-at-least'
      count: number
    }

export interface TrapAbility {
  text: string
  cost: AbilityCost
  condition?: TrapCondition
  effects: CardEffect[]
}

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
  sourceCardName?: string
}

export interface SupportCard {
  card: GameCard
  rested: boolean
}

export interface StageCard {
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
  stage: StageCard | null
  hasMulliganed: boolean
  startingCookieSelected: boolean
  freeMulliganDecided?: boolean
  forcedMulliganCount?: number
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

export interface ReplacementTask {
  playerId: PlayerId
  remaining: number
}

export interface PendingFaintEffect {
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName?: string
  effect: CardEffect
  context: EffectContext
}

export interface PendingAfterDamageEffect {
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName?: string
  effect: CardEffect
  context: EffectContext
}

export type PendingEffectOrderKind =
  | 'faint-effect'
  | 'after-damage-effect'
  | 'draw-up-to'
  | 'inspect-deck'
  | 'stage-trigger'

export interface PendingEffectOrderItem {
  id: string
  kind: PendingEffectOrderKind
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
}

export interface PendingEffectOrder {
  playerId: PlayerId
  items: PendingEffectOrderItem[]
  resolvedOrder?: string[]
}

export interface PendingReplacement {
  tasks: ReplacementTask[]
}

export interface PendingOpponentHandDiscard {
  playerId: PlayerId
  count: number
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
}

export interface CommandLogEntry {
  id: number
  turnNumber: number
  phase: TurnPhase
  playerId: PlayerId
  commandKind: string
  payload: Record<string, unknown>
}

export interface GameState {
  players: Record<PlayerId, PlayerState>
  firstPlayerId: PlayerId
  activePlayerId: PlayerId
  turnNumber: number
  phase: TurnPhase
  status: GameStatus
  result: GameResult | null
  commandLog?: CommandLogEntry[]
  supportPlacedThisTurn: boolean
  skillUsesThisTurn: string[]
  nextBattleEntrySequence: number
  attackModifiers: AttackModifier[]
  damageReceivedModifiers: DamageReceivedModifier[]
  flipDisabledUntilTurn?: Record<string, number>
  blockDisabledUntilTurn?: Partial<Record<PlayerId, number>>
  pendingReplacement: PendingReplacement | null
  departedCookieCounts: Record<PlayerId, number>
  pendingOnPlay?: {
    playerId: PlayerId
    sourceInstanceId: string
  } | null
  pendingDrawUpTo?: {
    playerId: PlayerId
    max: number
    sourcePlayerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    effectText?: string
    afterEffects?: CardEffect[]
    afterEffectContext?: EffectContext
  } | null
  pendingRefresh: {
    playerId: PlayerId
    remainingDraws: number
  } | null
  pendingBattle?: PendingBattle | null
  pendingFaintEffects?: PendingFaintEffect[]
  pendingAfterDamageEffects?: PendingAfterDamageEffect[]
  pendingEffectOrder?: PendingEffectOrder | null
  pendingOpponentHandDiscard?: PendingOpponentHandDiscard | null
  pendingInspectDeck?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    revealedCards: GameCard[]
    lookCount: number
    pickCount: number
    filterColor?: EnergyColor
  } | null
  pendingOptionalCostAttack?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    cost: AbilityCost
    effects: CardEffect[]
    effectText: string
  } | null
  pendingStageTrigger?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    effectText: string
  } | null
  supportAreaDecreasedThisTurn?: Partial<Record<PlayerId, boolean>>
}

export type PendingBattleStage =
  | 'trap'
  | 'damage'
  | 'flip'
  | 'attack-effect'

export interface PendingBattle {
  attackerPlayerId: PlayerId
  defenderPlayerId: PlayerId
  attackerInstanceId: string
  targetInstanceId: string
  declaredDamage: number
  remainingDamage: number
  stage: PendingBattleStage
  trapUsed: boolean
  revealedHpCard: GameCard | null
  preventKnockoutTargetIds: string[]
  faintedColors: EnergyColor[]
  attackEffects: CardEffect[]
  attackEffectIndex: number
  damagePlayerId?: PlayerId
  damageTargetInstanceId?: string
  suspendedAttackDamage?: number
  damagedInstanceIds?: string[]
  delayedTrap?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    color: EnergyColor
    effects: CardEffect[]
  }
}

export interface PlayerSetup {
  id: PlayerId
  name: string
  deck: GameCard[]
}

export type Shuffle = (cards: GameCard[]) => GameCard[]
