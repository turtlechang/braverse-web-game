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
  | 'pure'

/**
 * 官方卡片分類；PURE 是通用卡牌族群與特殊能量類型，不是核心五色或萬用能量。
 */
export type CardColor = EnergyColor

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
  /** Energy supplied by the Cookie itself when a triggered skill is used. */
  sourceEnergy?: EnergyCost
  faint?: boolean
  endPhase?: boolean
  afterDamage?: boolean
  /**
   * 整局只能發動一次（BS3-025）。官方釋疑：是每位玩家限定一次，即使同一玩家
   * 休息區有多張同名卡也共用這一次額度，因此 GameState.skillUsesThisGame
   * 記的是 `playerId:card.id`（同名卡共用），不是 card.instanceId。
   */
  oncePerGame?: boolean
  /** 技能來源在休息區時才能發動（BS3-025）；一般技能只看戰鬥區。 */
  fromBreakArea?: boolean
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
  specialVictory?: SpecialVictoryCondition
}

export type CardKeyword = 'ancient' | 'soul-jam'

export interface DistinctNamedKeywordRequirement {
  keyword: CardKeyword
  count: number
  cardType?: CardType
}

/**
 * 由主動發動的卡牌能力檢查；不會在條件自然成立時自動結束對局。
 */
export interface DistinctNamedKeywordsVictoryCondition {
  kind: 'distinct-named-keywords'
  requirements: DistinctNamedKeywordRequirement[]
}

export type SpecialVictoryCondition =
  | DistinctNamedKeywordsVictoryCondition

export interface BaseCard {
  id: string
  instanceId: string
  name: string
  imageUrl?: string
  cardColor?: CardColor
  energyColor?: EnergyColor | 'wild'
  keywords?: CardKeyword[]
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
  /** Some official FLIP cards can be attached as HP but have no attack. */
  nonAttackable?: boolean
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
  /** Item cards attached by an Equip effect. They leave with this Cookie. */
  equippedCards?: GameCard[]
}

export type EffectTargetSide = 'self' | 'opponent'

/**
 * 目標選取可以跨雙方戰鬥區（官方文字的「either player's battle area」）。
 * `either` 的擁有者必須逐一從被選中的餅乾推導，只有明確處理過的效果可以使用，
 * 目前是 `battle-to-break` 與 `battle-to-deck-top`。
 */
export type EffectTargetSelectorSide = EffectTargetSide | 'either'

export interface EffectTargetSelector {
  side: EffectTargetSelectorSide
  min: number
  max: number
  excludeSource?: boolean
  sourceOnly?: boolean
  remainingHp?: number
  minRemainingHp?: number
  minLevel?: number
  maxLevel?: number
  energyColor?: EnergyColor
  attackTargetOnly?: boolean
  excludeAttackTarget?: boolean
  /** 只有休息中的餅乾是合法目標，用於「設為活躍」類效果。 */
  restedOnly?: boolean
  /** Restrict Cookie targets to cards carrying an official runtime keyword. */
  keyword?: CardKeyword
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

/** 支援區指定顏色張數達到門檻（BS4-048 的「support area contains 7 {G} cards or more」）。 */
export interface SupportColorCountAtLeastCondition {
  kind: 'support-color-count-at-least'
  color: EnergyColor
  count: number
}

/** 支援區張數不超過門檻（BS3-067 的「support area contains 6 cards or less」）。 */
export interface SupportCountAtMostCondition {
  kind: 'support-count-at-most'
  count: number
}

/** 對手支援區張數達到門檻（BS3-072 的「if your opponent's support area contains 5 or more」）。 */
export interface OpponentSupportCountAtLeastCondition {
  kind: 'opponent-support-count-at-least'
  count: number
}

export interface ActiveSupportCountAtLeastCondition {
  kind: 'active-support-count-at-least'
  count: number
}

export interface TrashColorCountAtLeastCondition {
  kind: 'trash-color-count-at-least'
  color: EnergyColor
  count: number
}

export interface HandCountAtMostCondition {
  kind: 'hand-count-at-most'
  count: number
}

/** 手牌張數達到門檻（BS4-083 的「if your hand contains 5 cards or more」）。 */
export interface HandCountAtLeastCondition {
  kind: 'hand-count-at-least'
  count: number
}

export interface SupportAreaDecreasedThisTurnCondition {
  kind: 'support-area-decreased-this-turn'
}

export interface OpponentHasCookieWithLevelCondition {
  kind: 'opponent-has-cookie-with-level'
  level: number
}

/** The Cookie currently attacking the source has at most the given level. */
export interface AttackerLevelAtMostCondition {
  kind: 'attacker-level-at-most'
  level: number
}

/**
 * 對手戰鬥區餅乾數量剛好等於門檻（BS4-089 的「如果對手的戰鬥區有2個餅乾」，
 * 中文卡面同一張卡另一段用「或更多」明確標示「至少」，這裡沒有那個字尾，
 * 確認是剛好等於，不是至少）。
 */
export interface OpponentBattleAreaCookieCountCondition {
  kind: 'opponent-battle-area-cookie-count'
  count: number
}

export interface BattleAreaHasCookieWithLevelCondition {
  kind: 'battle-area-has-cookie-with-level'
  side: EffectTargetSide
  level: number
}

/** 場上有指定顏色的餅乾（BS4-003 的「if there is another {R} Cookie in your battle area」）。 */
export interface BattleAreaHasColorCondition {
  kind: 'battle-area-has-color'
  side: EffectTargetSide
  color: EnergyColor
  /** 「another」：不算來源自己。 */
  excludeSource?: boolean
  /**
   * 同一張卡要「既是這個顏色又是這個等級」才算數（BS4-094 的「{P} LV.3
   * Cookie」，中文卡面用「且」明確連接顏色與等級，是同一張卡的兩個條件，
   * 不是分開各自判定存在）。不給則只看顏色。
   */
  level?: number
}

/** 官方文字「某色 LV.N 餅乾在你的休息區」。 */
export interface BreakAreaHasCardCondition {
  kind: 'break-area-has-card'
  side: EffectTargetSide
  color?: EnergyColor
  minLevel?: number
  maxLevel?: number
}

export interface TrashCountAtLeastCondition {
  kind: 'trash-count-at-least'
  count: number
}

/** 己方棄牌區張數不超過門檻（BS4-110 的「if your trash contains 15 cards or less」）。 */
export interface TrashCountAtMostCondition {
  kind: 'trash-count-at-most'
  count: number
}

/** 官方文字「棄牌區有 N 張帶有 FLIP 的卡牌」。 */
export interface TrashFlipCountAtLeastCondition {
  kind: 'trash-flip-count-at-least'
  count: number
}

/** 對手休息區等級總和不超過門檻（BS3-028 的「LV.6 or lower」）。 */
export interface OpponentBreakLevelAtMostCondition {
  kind: 'opponent-break-level-at-most'
  level: number
}

/** 己方休息區等級總和高於對手（P-009 的「if your break area LV. is higher than your opponent's」）。 */
export interface BreakLevelHigherThanOpponentCondition {
  kind: 'break-level-higher-than-opponent'
}

export interface SourceHpLessThanCondition {
  kind: 'source-hp-less-than'
  amount: number
}

export interface SourceHpAtLeastCondition {
  kind: 'source-hp-at-least'
  amount: number
}

/** The source has left the battle area for its owner's break area. */
export interface SourceInBreakAreaCondition {
  kind: 'source-in-break-area'
}

/** An opponent Cookie fainted while resolving the current attack. */
export interface OpponentCookieFaintedInCurrentBattleCondition {
  kind: 'opponent-cookie-fainted-in-current-battle'
}

/**
 * 本次攻擊宣告的目標，攻擊當下的剩餘 HP 卡數達到門檻（BS3-001「when this
 * Cookie attacks your opponent's Cookie whose remaining HP is 4 or more」）。
 * 只在來源正是 `state.pendingBattle` 的攻擊者時成立，沒有進行中的戰鬥（或
 * 來源不是攻擊者）一律視為不成立。
 */
export interface AttackTargetRemainingHpAtLeastCondition {
  kind: 'attack-target-remaining-hp-at-least'
  amount: number
}

/** 本次攻擊宣告的目標等級達到上限（BS4-009 的「if the attacked Cookie is LV.2 or lower」）。 */
export interface AttackTargetLevelAtMostCondition {
  kind: 'attack-target-level-at-most'
  level: number
}

export interface SupportKeywordAtLeastCondition {
  kind: 'support-keyword-at-least'
  keyword: CardKeyword
  count: number
}

export interface DistinctNamedFamilyCountCondition {
  kind: 'distinct-named-family-count'
  family: 'marzipan-cookie'
  battleAreaCount: number
  supportAreaCount: number
}

export interface AnyBattleAreaHasBlockerCondition {
  kind: 'any-battle-area-has-blocker'
}

export interface OpponentBattleAreaHasNoBlockerCondition {
  kind: 'opponent-battle-area-has-no-blocker'
}

/**
 * 複合條件：全部子條件都成立才算成立（BS4-077 的「if your hand contains 5
 * cards or less and there is a {B} Cookie in your battle area」）。
 */
export interface AllOfCondition {
  kind: 'all-of'
  conditions: EffectCondition[]
}

export type EffectCondition =
  | AllOfCondition
  | BreakLevelCondition
  | OpponentTrashCountAtLeastCondition
  | SupportCountAtLeastCondition
  | SupportColorCountAtLeastCondition
  | SupportCountAtMostCondition
  | OpponentSupportCountAtLeastCondition
  | ActiveSupportCountAtLeastCondition
  | TrashColorCountAtLeastCondition
  | HandCountAtMostCondition
  | HandCountAtLeastCondition
  | SupportAreaDecreasedThisTurnCondition
  | OpponentHasCookieWithLevelCondition
  | AttackerLevelAtMostCondition
  | OpponentBattleAreaCookieCountCondition
  | BattleAreaHasCookieWithLevelCondition
  | BattleAreaHasColorCondition
  | BreakAreaHasCardCondition
  | TrashCountAtLeastCondition
  | TrashCountAtMostCondition
  | TrashFlipCountAtLeastCondition
  | OpponentBreakLevelAtMostCondition
  | SourceHpLessThanCondition
  | SourceHpAtLeastCondition
  | SourceInBreakAreaCondition
  | OpponentCookieFaintedInCurrentBattleCondition
  | AttackTargetRemainingHpAtLeastCondition
  | AttackTargetLevelAtMostCondition
  | SupportKeywordAtLeastCondition
  | DistinctNamedFamilyCountCondition
  | AnyBattleAreaHasBlockerCondition
  | OpponentBattleAreaHasNoBlockerCondition
  | BreakLevelHigherThanOpponentCondition

export interface DamageEffect {
  kind: 'damage'
  amount: number
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface SplitDamageEffect {
  kind: 'split-damage'
  primaryAmount: number
  secondaryAmount: number
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface DamageAllEffect {
  kind: 'damage-all'
  amount: number
  side: EffectTargetSide
  condition?: EffectCondition
  /** 排除來源自己（P-018「Deals damage to all Cookies other than this Cookie」）。 */
  excludeSource?: boolean
  /**
   * 逐一選定並處理所有目標；每一張 HP 卡的 FLIP 都必須在下一個目標前完成。
   * 僅用於卡面明確要求全體傷害仍需依序結算的效果（BS4-005）。
   */
  sequential?: boolean
  /** `sequential` 時用於 UI 選取所有合法目標，點擊順序即傷害順序。 */
  target?: EffectTargetSelector
}

export interface DamageByBreakCountEffect {
  kind: 'damage-by-break-count'
  target: EffectTargetSelector
  perCount: number
  minBreakLevel?: number
  exactBreakLevel?: number
  breakEnergyColor?: EnergyColor
  condition?: EffectCondition
}

export interface DamageByBreakLevelDifferenceEffect {
  kind: 'damage-by-break-level-difference'
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface ModifyAttackByBreakCountEffect {
  kind: 'modify-attack-by-break-count'
  target: EffectTargetSelector
  duration: EffectDuration
  perCount: number
  /** 每滿 N 張休息區卡才套用一次 perCount，預設 1（即「for each」）；官方文字「for every N」時設為 N */
  groupSize?: number
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

export interface ModifyAttackCostEffect {
  kind: 'modify-attack-cost'
  target: EffectTargetSelector
  energyCost: EnergyCost
  duration: EffectDuration
  condition?: EffectCondition
}

export interface MultiplyAttackDamageEffect {
  kind: 'multiply-attack-damage'
  multiplier: number
  condition?: EffectCondition
}

export interface ModifyDamageReceivedEffect {
  kind: 'modify-damage-received'
  amount: number
  duration: EffectDuration
  target: EffectTargetSelector
  condition?: EffectCondition
  minimumDamage?: number
  setDamageTo?: number
}

export interface DrawEffect {
  kind: 'draw'
  amount: number
  side?: 'self' | 'opponent'
  condition?: EffectCondition
}

export interface DrawUpToEffect {
  kind: 'draw-up-to'
  max: number
  condition?: EffectCondition
}

export interface DrawUpToThenDiscardEffect {
  kind: 'draw-up-to-then-discard'
  max: number
  discardCount: number
  /** 抽完後選出的手牌去向；預設棄牌區，`deck-top` 用於 BS3-088。 */
  handDestination?: 'trash' | 'deck-top'
  condition?: EffectCondition
  target?: EffectTargetSelector
}

export interface DrawUpToOpponentFaintedThisTurnEffect {
  kind: 'draw-up-to-opponent-fainted-this-turn'
  amountPerFainted: number
  condition?: EffectCondition
  target?: EffectTargetSelector
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

/** Move cards directly from a deck's top to its discard pile; this is not a draw. */
export interface DeckToTrashEffect {
  kind: 'deck-to-trash'
  amount: number
  side: EffectTargetSide
  condition?: EffectCondition
}

export interface BreakToTrashEffect {
  kind: 'break-to-trash'
  max: number
  energyColor?: EnergyColor
  exactLevel?: number
  maxLevel?: number
  condition?: EffectCondition
}

/** 從棄牌區選餅乾放進自己的休息區（P-016，跟 `break-to-trash` 方向相反）。 */
export interface TrashToBreakEffect {
  kind: 'trash-to-break'
  amount: number
  energyColor?: EnergyColor
  exactLevel?: number
  maxLevel?: number
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
  condition?: EffectCondition
}

export interface PlaceSourceToSupportEffect {
  kind: 'place-source-to-support'
  rested?: boolean
}

export interface SupportToTrashEffect {
  kind: 'support-to-trash'
  amount: number
  side?: EffectTargetSide
  activeOnly?: boolean
  optional?: boolean
  condition?: EffectCondition
}

export interface DisableFlipEffect {
  kind: 'disable-flip'
  duration: 'this-turn'
  target: EffectTargetSelector
  /**
   * BS3-071：若被選中的目標之一等級剛好是這個數字，來源場景卡本回合結算後
   * 直接送入棄牌區。目標是攻擊當下才選定的，這個條件依附在選擇結果上，
   * 不是一般看場面狀態的 EffectCondition，所以直接掛在效果本身而不是
   * `condition` 欄位。
   */
  trashSourceIfTargetLevel?: number
}

export interface DisableBlockEffect {
  kind: 'disable-block'
  duration: 'this-turn'
  side: 'opponent'
}

export interface PreventEffectDamageEffect {
  kind: 'prevent-effect-damage'
  duration: 'until-source-next-turn'
  target: EffectTargetSelector
  condition?: EffectCondition
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
  energyColor?: CookieCard['energyColor']
  minLevel?: number
}

export interface BattleToSupportEffect {
  kind: 'battle-to-support'
  target: EffectTargetSelector
  /** 移入支援區時是否橫置；預設不橫置（BS4-049 的「as rested」）。 */
  rested?: boolean
}

export interface TrashToBattleEffect {
  kind: 'trash-to-battle'
  amount: number
  energyColor?: EnergyColor
}

export interface SupportToHandEffect {
  kind: 'support-to-hand'
  amount: number
  maxLevel?: number
  condition?: EffectCondition
  optional?: boolean
}

export interface HandToSupportEffect {
  kind: 'hand-to-support'
  amount: number
  rested?: boolean
  condition?: EffectCondition
}

export interface OpponentDiscardHandEffect {
  kind: 'opponent-discard-hand'
  count: number
  /** 對手選中的手牌去向；未指定時維持原本的棄牌區語意。 */
  destination?: 'trash' | 'deck-top' | 'deck-bottom'
}

export interface DiscardHandEffect {
  kind: 'discard-hand'
  count: number
  /** 選出的手牌去向；預設棄牌區，`deck-top` 用於「放到牌庫頂」（BS3-088）。 */
  destination?: 'trash' | 'deck-top' | 'deck-bottom'
  condition?: EffectCondition
}

/**
 * 揭示牌庫底 1 張，依是否為 Cookie 決定去向（BS3-073）。
 * 牌庫為空時直接略過，對應官方文字的「up to 1」。
 */
export interface RevealBottomDeckEffect {
  kind: 'reveal-bottom-deck'
  cookieDestination: 'deck-top' | 'hand'
  otherwiseDestination: 'deck-top' | 'hand'
  condition?: EffectCondition
}

/** 從手牌讓餅乾登場（BS3-029）；HP 卡照常自牌庫頂補入。 */
export interface HandToBattleEffect {
  kind: 'hand-to-battle'
  amount: number
  energyColor?: EnergyColor
  /** 登場前需支付的能量（BS3-029）。 */
  energyCost?: EnergyCost
  minLevel?: number
  maxLevel?: number
  optional?: boolean
  /** 登場後額外補入的 HP 卡數。 */
  gainHp?: number
  condition?: EffectCondition
}

export interface ChooseOneMode {
  /** 顯示給玩家的模式說明。 */
  label: string
  effects: CardEffect[]
}

/**
 * 官方文字的「Select 1 of the following.」（BS3-068）。
 * 這個效果本身不會被執行：玩家或 AI 選定模式後，會就地展開成該模式的效果，
 * 之後每個子效果照常各自走目標選取流程。
 */
export interface ChooseOneEffect {
  kind: 'choose-one'
  modes: ChooseOneMode[]
  condition?: EffectCondition
}

/** 從對手棄牌區選餅乾放進對手休息區（BS3-028）。 */
export interface OpponentTrashToBreakEffect {
  kind: 'opponent-trash-to-break'
  max: number
  exactLevel?: number
  maxLevel?: number
  condition?: EffectCondition
}

export interface OpponentBattleToTrashEffect {
  kind: 'opponent-battle-to-trash'
  /** Defaults to 1 so legacy effects still require a target. */
  min?: number
  maxLevel?: number
  minLevel?: number
  remainingHp?: number
  destination?: 'trash' | 'break'
  condition?: EffectCondition
}

export interface FieldToTrashEffect {
  kind: 'field-to-trash'
  target: EffectTargetSelector
  allowStage?: boolean
  stageOnly?: boolean
  stageLevel?: number
  condition?: EffectCondition
  autoSelect?: boolean
}

export interface FieldToTrashAllEffect {
  kind: 'field-to-trash-all'
  maxLevel?: number
  minLevel?: number
}

export interface DisableAttackEffect {
  kind: 'disable-attack'
  duration: EffectDuration
  target: EffectTargetSelector
}

export interface SetActiveEffect {
  kind: 'set-active'
  supportCount: number
  /** When true, the controller chooses the support cards instead of using engine order. */
  selectable?: boolean
  condition?: EffectCondition
}

export interface RevealTopDeckEffect {
  kind: 'reveal-top-deck'
  match: {
    type?: GameCard['type']
    energyColor?: EnergyColor
    level?: number
  }
  effects: CardEffect[]
}

export interface HandToBreakEffect {
  kind: 'hand-to-break'
  amount: number
  energyColor?: EnergyColor
  minLevel?: number
  maxLevel?: number
  nonCookieOnly?: boolean
  optional?: boolean
}

export interface HandToBreakBySumEffect {
  kind: 'hand-to-break-by-level-sum'
  targetSum: number
  energyColor?: EnergyColor
}

export interface BreakToHandEffect {
  kind: 'break-to-hand'
  amount: number
  energyColor?: EnergyColor
  minLevel?: number
  maxLevel?: number
  optional?: boolean
}

export interface HandToHpEffect {
  kind: 'hand-to-hp'
  target: EffectTargetSelector
  energyColor?: EnergyColor
  optional?: boolean
  /** When true, select the hand card and the destination Cookie together. */
  selectTarget?: boolean
}

export interface HpToHandEffect {
  kind: 'hp-to-hand'
  amount: number
  target: EffectTargetSelector
}

export interface CycleHpEffect {
  kind: 'cycle-hp'
  target: EffectTargetSelector
  energyColor?: EnergyColor
}

/**
 * 在來源餅乾與選定餅乾之間搬移 HP 卡。取牌與放牌都在 HP 頂端（`hpCards` 陣列尾端）。
 * `to-source` 是把選定餅乾的 HP 移給來源（BS3-031），
 * `from-source` 則是把來源的 HP 移給選定餅乾（BS3-089）。
 * 供牌方 HP 歸零時照常昏厥。
 */
export interface TransferHpEffect {
  kind: 'transfer-hp'
  amount: number
  direction: 'to-source' | 'from-source'
  target: EffectTargetSelector
  condition?: EffectCondition
}

/**
 * 讓技能來源自己從休息區登場，並以固定張數的 HP 卡上場（BS3-025）。
 * 與 `break-to-battle` 不同：對象固定是效果來源，且 HP 不是卡面 HP。
 */
export interface BreakSourceToBattleEffect {
  kind: 'break-source-to-battle'
  hpCount: number
  condition?: EffectCondition
}

/** 來源場景卡自己離開場景區、送回牌庫頂或底（BS3-095「Then」分支）。 */
export interface StageSourceToDeckEffect {
  kind: 'stage-source-to-deck'
  destination: 'top' | 'bottom'
  condition?: EffectCondition
}

/** 來源場景卡自己離開場景區、送入棄牌區（BS3-120「Then」分支）。 */
export interface StageSourceToTrashEffect {
  kind: 'stage-source-to-trash'
  condition?: EffectCondition
  /** 此效果無可選目標，但為了與 CardEffect union 中其他帶 target 的型別相容，保留 target = undefined。 */
  target?: undefined
}

/** 讓選定的餅乾解除休息；`set-active` 只處理支援區，兩者不共用。 */
export interface SetCookieActiveEffect {
  kind: 'set-cookie-active'
  target: EffectTargetSelector
  condition?: EffectCondition
}

/** 依雙方戰鬥區中指定等級的餅乾數量決定抽牌上限（BS3-092）。 */
export interface DrawUpToBattleCookieCountEffect {
  kind: 'draw-up-to-battle-cookie-count'
  level: number
  amountPerCookie: number
  condition?: EffectCondition
}

/** 將棄牌區所有卡牌洗回牌庫；與 `trash-to-deck` 不同，不需要選擇。 */
export interface TrashToDeckAllEffect {
  kind: 'trash-to-deck-all'
  condition?: EffectCondition
  /**
   * 洗回牌庫後接著執行的效果（官方文字的「Then, ...」）。
   * 必須內嵌而不能拆成同層的下一個效果：本效果會清空棄牌區，
   * 若下一個效果重複掛同一個棄牌區條件，重新判定時必定失敗而被跳過。
   */
  thenEffects?: CardEffect[]
}

export interface BattleToDeckTopEffect {
  kind: 'battle-to-deck-top'
  target: EffectTargetSelector
}

export interface RestSupportEffect {
  kind: 'rest-support'
  side: EffectTargetSide
  amount: number
  energyColor?: EnergyColor
  activeOnly?: boolean
  optional?: boolean
  condition?: EffectCondition
}

export interface RestSupportAndDamageEffect {
  kind: 'rest-support-and-damage'
  supportSide: EffectTargetSide
  supportAmount: number
  supportEnergyColor?: EnergyColor
  activeOnly?: boolean
  target: EffectTargetSelector
}

export interface SupportToHpEffect {
  kind: 'support-to-hp'
  target: EffectTargetSelector
  energyColor?: EnergyColor
  optional?: boolean
  /** When true, select the support card and the destination Cookie together. */
  selectTarget?: boolean
}

export interface EquipSourceEffect {
  kind: 'equip-source'
  target: EffectTargetSelector
  requiredCookieId: string
  attackBonus?: number
  gainHp?: number
}

/** 未被選走的檢視卡去向；`bottom`／`top` 由玩家決定順序，`trash` 直接棄置。 */
export type InspectDeckRestDestination = 'bottom' | 'top' | 'trash'

export interface InspectDeckEffect {
  kind: 'inspect-deck'
  lookCount: number
  pickCount: number
  restDestination: InspectDeckRestDestination
  /** 被選走的卡去向；預設加入手牌，`battle` 代表直接登場（BS3-114）。 */
  pickDestination?: 'hand' | 'battle'
  filterColor?: EnergyColor
  /** 只有此類型的卡可被選走，例如 BS3-114 限定 Cookie。 */
  filterType?: GameCard['type']
  /** 官方文字的「up to」：可以一張都不選（BS3-114）。 */
  optionalPick?: boolean
}

export interface OptionalCostAttackEffect {
  kind: 'optional-cost-attack'
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
  /** 攻擊餅乾自身能提供的額外費用；其餘費用才由支援區支付。 */
  sourceEnergy?: EnergyCost
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
  condition?: EffectCondition
}

export interface TrashToSupportEffect {
  kind: 'trash-to-support'
  amount: number
  rested?: boolean
}

export interface TrashToHandEffect {
  kind: 'trash-to-hand'
  max: number
  energyColor?: EnergyColor
  /** 只有 Cookie 是合法選擇（BS3-112 的「{P} Cookie」）。 */
  cookieOnly?: boolean
}

export interface TrashToDeckEffect {
  kind: 'trash-to-deck'
  max: number
  excludeFlip?: boolean
  /** 指定牌庫底時保留玩家選取順序；未指定時維持洗回牌庫。 */
  destination?: 'bottom'
}

export interface HpToSupportEffect {
  kind: 'hp-to-support'
  amount: number
  target: EffectTargetSelector
  rested?: boolean
}

export interface BreakToBattleEffect {
  kind: 'break-to-battle'
  amount: number
  exactLevel?: number
  maxLevel?: number
  energyColor?: EnergyColor
}

/** 從自己支援區選餅乾登場戰鬥區（BS4-058），跟 break-to-battle 同一種形狀，只是來源區不同。 */
export interface SupportToBattleEffect {
  kind: 'support-to-battle'
  amount: number
  exactLevel?: number
  maxLevel?: number
  energyColor?: EnergyColor
}

export interface BattleToBreakEffect {
  kind: 'battle-to-break'
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface BreakToHandBySumEffect {
  kind: 'break-to-hand-by-level-sum'
  targetSum: number
  energyColor?: EnergyColor
}

export interface FlipToSupportEffect {
  kind: 'flip-to-support'
  rested?: boolean
  condition?: EffectCondition
}

export interface FlipToBreakEffect {
  kind: 'flip-to-break'
  condition?: EffectCondition
}

export interface DiscardHandAllEffect {
  kind: 'discard-hand-all'
}

export interface DrawUntilHandEqualsOpponentEffect {
  kind: 'draw-until-hand-equals-opponent'
}

export interface FieldToDeckBottomEffect {
  kind: 'field-to-deck-bottom'
  target: EffectTargetSelector
  allowStage?: boolean
  /** When `target.side` is `either`, restrict Cookie targets without restricting stages. */
  battleSide?: EffectTargetSide
}

export interface FieldToDeckBottomAllEffect {
  kind: 'field-to-deck-bottom-all'
  maxLevel?: number
  minLevel?: number
}

export type CardEffect =
  | DamageEffect
  | SplitDamageEffect
  | DamageAllEffect
  | DamageByBreakCountEffect
  | DamageByBreakLevelDifferenceEffect
  | ModifyAttackByBreakCountEffect
  | ModifyAttackEffect
  | ModifyAttackCostEffect
  | MultiplyAttackDamageEffect
  | ModifyDamageReceivedEffect
  | DrawEffect
  | DrawUpToEffect
  | DrawUpToThenDiscardEffect
  | DrawUpToOpponentFaintedThisTurnEffect
  | HandToDeckAndDrawEffect
  | DeckToSupportEffect
  | DeckToTrashEffect
  | BreakToTrashEffect
  | GainHpEffect
  | PreventKnockoutEffect
  | RedirectAttackEffect
  | PlaceSourceToSupportEffect
  | SupportToTrashEffect
  | DisableFlipEffect
  | DisableBlockEffect
  | PreventEffectDamageEffect
  | ViewHpEffect
  | ModifyAllAttackEffect
  | BattleToSupportEffect
  | TrashToBattleEffect
  | SupportToHandEffect
  | HandToSupportEffect
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
  | FieldToTrashAllEffect
  | DisableAttackEffect
  | TrashToHandEffect
  | TrashToDeckEffect
  | HpToSupportEffect
  | BreakToBattleEffect
  | SupportToBattleEffect
  | BattleToBreakEffect
  | BreakToHandBySumEffect
  | HandToBreakBySumEffect
  | FlipToSupportEffect
  | FlipToBreakEffect
  | RevealTopDeckEffect
  | HandToBreakEffect
  | BreakToHandEffect
  | HandToHpEffect
  | HpToHandEffect
  | CycleHpEffect
  | BattleToDeckTopEffect
  | RestSupportEffect
  | RestSupportAndDamageEffect
  | SupportToHpEffect
  | EquipSourceEffect
  | TransferHpEffect
  | SetCookieActiveEffect
  | DrawUpToBattleCookieCountEffect
  | TrashToDeckAllEffect
  | DiscardHandAllEffect
  | DrawUntilHandEqualsOpponentEffect
  | FieldToDeckBottomEffect
  | FieldToDeckBottomAllEffect
  | RevealBottomDeckEffect
  | HandToBattleEffect
  | OpponentTrashToBreakEffect
  | ChooseOneEffect
  | BreakSourceToBattleEffect
  | StageSourceToDeckEffect
  | StageSourceToTrashEffect
  | TrashToBreakEffect

export type TargetedCardEffect =
  | DamageEffect
  | SplitDamageEffect
  | DamageByBreakCountEffect
  | DamageByBreakLevelDifferenceEffect
  | ModifyAttackByBreakCountEffect
  | ModifyAttackEffect
  | ModifyAttackCostEffect
  | ModifyDamageReceivedEffect
  | PreventKnockoutEffect
  | PreventEffectDamageEffect
  | DisableFlipEffect
  | ViewHpEffect
  | BattleToSupportEffect
  | ReturnToHandEffect
  | ReturnToDeckBottomEffect
  | FieldToTrashEffect
  | RedirectAttackEffect
  | HpToTrashEffect
  | DisableAttackEffect
  | HpToSupportEffect
  | HandToHpEffect
  | HpToHandEffect
  | SupportToHpEffect
  | EquipSourceEffect
  | BattleToBreakEffect
  | TransferHpEffect
  | SetCookieActiveEffect
  | CycleHpEffect
  | RestSupportAndDamageEffect
  | FieldToDeckBottomEffect

export type AbilityCost = EnergyCost & {
  energy?: EnergyCost
  discardHand?: number
  discardHandColor?: EnergyColor
  /** 限定棄置的手牌類型，例如「Discard 1 {R} Trap card」。 */
  discardHandType?: GameCard['type']
  supportToTrash?: number
  supportToHand?: number
  hpToTrash?: {
    amount?: number
    untilRemainingHp?: number
    /** 「this Cookie's HP」類代價只能由技能來源本身支付。 */
    sourceOnly?: boolean
    /** 「your other Cookie」類代價不能選擇技能來源。 */
    excludeSource?: boolean
    /** 限定可支付 HP 的餅乾顏色，例如「your {R} Cookie's HP」。 */
    energyColor?: EnergyColor
    /** 限定可支付 HP 的餅乾等級範圍。 */
    minLevel?: number
    maxLevel?: number
  }
  trashBattleCookie?: {
    count: number
    level?: number
    minLevel?: number
    maxLevel?: number
    energyColor?: EnergyColor
    sourceOnly?: boolean
    excludeSource?: boolean
  }
  selfToBreakArea?: boolean
  /** 來源自己離開戰鬥區、放到自己牌庫最下方作為代價（BS4-077）。 */
  selfToDeckBottom?: boolean
  /**
   * 從棄牌區選指定條件的卡牌洗回牌庫作為代價（BS3-098）。
   * 與 `trashToDeckBottom` 不同，結算後會將選取卡牌與牌庫合併並洗牌。
   */
  trashToDeck?: {
    count: number
    energyColor?: EnergyColor
    excludeFlip?: boolean
  }
  /**
   * 從棄牌區選卡放到牌庫底作為代價（BS3-112）。
   * 目前只有餅乾技能路徑（activate-skill／begin-activate-skill）實作，
   * item／stage 的 payAbilityCost 會直接拒絕，避免被靜默忽略。
   */
  trashToDeckBottom?: {
    count: number
    nonCookieOnly?: boolean
  }
  /**
   * 將手牌餅乾放入自己的休息區作為代價（BS3-046）。
   * 與 `discardHand`（放入棄牌區）不同，這會推進自己的 break 等級。
   * 目前只有陷阱路徑（`playTrap`）實作。
   */
  handToBreakArea?: {
    count: number
    energyColor?: EnergyColor
  }
}

export interface FlipAbility {
  text: string
  cost: AbilityCost
  effects: CardEffect[]
}

/**
 * 注意：`'opponent-trash-count-at-least'` 這個 kind 名稱在 TrapCondition 與
 * CardEffect 的 EffectCondition（見上方 OpponentTrashCountAtLeastCondition／
 * effects/targeting.ts 的 isEffectConditionMet）語意不同：
 * - TrapCondition（本檔案下方、由 battle.ts 的 isTrapConditionMet 評估）：
 *   檢查的是陷阱擁有者（防守方）自己的棄牌區，不是對手／攻擊方的。
 * - EffectCondition（供 item／skill／attack-effect 使用）：檢查的才是對手的
 *   棄牌區（getOpponentId(context.sourcePlayerId)）。
 * 這是官方卡牌文字裡「if there are N cards or more in your trash」的陷阱版
 * 解析結果（parseTrapCondition，見 official-effect-adapter.ts），「your」對
 * 陷阱擁有者而言就是自己，命名沿用舊有 kind 字串、未特別更名以免影響既有資料，
 * 不要因為名稱看起來像「檢查對手」就去「修正」battle.ts 的評估邏輯。
 */
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
      /**
       * 只有等級達標的己方餅乾昏厥才算數（BS3-046 的「LV.2 or higher」）。
       * 未指定時沿用舊行為：只看本次戰鬥有沒有該顏色的餅乾昏厥，不分擁有者與等級。
       */
      minLevel?: number
    }
  | {
      kind: 'friendly-cookie-fainted-this-battle'
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

export interface AttackCostModifier {
  sourceInstanceId: string
  targetInstanceId: string
  energyCost: EnergyCost
  expiresAfterTurn: number | null
}

export interface DamageReceivedModifier {
  sourceInstanceId: string
  targetInstanceId: string
  amount: number
  expiresAfterTurn: number | null
  minimumDamage?: number
  setDamageTo?: number
}

export interface EffectContext {
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName?: string
  /**
   * 攻擊宣告當下明確傳入的目標，優先於 `state.pendingBattle`（BS3-001）。
   * `beginAttack` 計算宣告傷害時，`pendingBattle` 尚未寫入 state，
   * 這時只能靠呼叫端把當次目標直接帶進 context。
   */
  attackTargetInstanceId?: string
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

export type VictoryReason = 'special-victory'

export type GameEndReason = DefeatReason | VictoryReason

export interface GameResult {
  winnerId: PlayerId
  loserId: PlayerId
  reason: GameEndReason
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
  | 'reveal-top-deck'
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
  /** 未指定時視為 `trash`，與此欄位加入前的行為一致。 */
  destination?: 'trash' | 'deck-top' | 'deck-bottom'
  /**
   * 這個棄牌決策是不是緊接在同一張卡的 draw-up-to-then-discard 之後
   * （BS3-070／BS3-088）。UI 用這個欄位判斷要不要顯示「步驟 2/2」的接續
   * 提示，讓玩家感覺是同一個效果的兩個步驟，而不是兩個互不相關的彈窗。
   */
  chainedFromDrawUpTo?: boolean
}

/** 對戰紀錄的分類標籤，供 UI 篩選 chip 使用。見 command-log.ts 的 LOG_CATEGORY_BY_COMMAND_KIND。 */
export type LogCategory =
  | 'draw'
  | 'deploy'
  | 'attack'
  | 'activate'
  | 'damage'
  | 'flip'
  | 'phase'
  | 'system'

/** 一個對戰紀錄步驟：說明文字＋這個步驟實際用到的卡片（供顯示縮圖用）。 */
export interface LogStepDetail {
  text: string
  cards?: GameCard[]
}

export interface CommandLogEntry {
  id: number
  turnNumber: number
  phase: TurnPhase
  playerId: PlayerId
  commandKind: string
  payload: Record<string, unknown>
  summary?: string
  /**
   * 同一個因果鏈（例如攻擊宣告→陷阱回應→逐張HP結算→FLIP→戰鬥自動結算）
   * 底下所有 entry 共用同一個 groupId，方便 UI 把它們摺疊成一組可展開的
   * 動作。獨立、沒有後續待決定事項的動作，groupId 等於自己的 id。
   */
  groupId?: number
  category?: LogCategory
  /** 這筆指令結算完成當下，雙方的休息區等級（用於回合分隔的進度條顯示）。 */
  breakLevel?: Record<PlayerId, number>
  /**
   * 「單筆 entry 但 payload 已經帶齊所有子步驟資料」的批次指令（play-trap／
   * activate-skill／play-item／activate-stage／attack）在附加當下就合成好的
   * 逐步驟文字，供 UI 展開顯示。必須在 appendCommandLogEntry 當下算好存起來
   * ——UI 端只看得到最終 GameState，沒有每筆 entry 對應的歷史狀態可以重算。
   * 其餘 kind（步驟本來就分散在同一 groupId 底下的其他 entry）維持 undefined。
   */
  steps?: LogStepDetail[]
  /**
   * 這筆指令主要「關於」哪一張卡，供 UI 顯示卡圖縮圖用。純系統/階段類指令
   * （advance-phase／skip-trap……）沒有對應單一卡片，維持 undefined。
   */
  card?: GameCard
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
  /** 整局只能發動一次的技能已用過的卡片 instanceId。 */
  skillUsesThisGame?: string[]
  nextBattleEntrySequence: number
  attackModifiers: AttackModifier[]
  attackCostModifiers?: AttackCostModifier[]
  damageReceivedModifiers: DamageReceivedModifier[]
  flipDisabledUntilTurn?: Record<string, number>
  attackDisabledUntilTurn?: Record<string, number>
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
    afterEffectsRequireDraw?: boolean
  } | null
  effectDamagePreventedUntilTurn?: Record<string, number>
  cookiesFaintedThisTurn?: Record<PlayerId, number>
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
    /** 未指定時視為 `bottom`，與此欄位加入前的行為一致。 */
    restDestination?: InspectDeckRestDestination
    pickDestination?: 'hand' | 'battle'
    filterColor?: EnergyColor
    filterType?: GameCard['type']
    optionalPick?: boolean
  } | null
  pendingRevealTopDeck?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    revealedCard: GameCard
    matched: boolean
    nestedEffects: CardEffect[]
    /**
     * 翻牌結算完之後欠戰鬥流程什麼動作。少了這個欄位就分不出兩種來源的 reveal，
     * 會拿攻擊後的收尾邏輯去處理陷阱裡的翻牌，把還沒打的傷害整個吃掉。
     *
     * - `finish`：BS3-076／080 這種攻擊後的 reveal。`finishBattle` 為了讓巢狀
     *   damage 的 `attackTargetOnly` 找得到攻擊目標而刻意保留 `pendingBattle`，
     *   翻牌結算完要回頭收尾。
     * - `after-trap`：BS3-093 這種陷阱裡的 reveal。戰鬥還停在陷阱視窗，巢狀效果
     *   可能再改一次攻擊力，結算完才由 `advanceBattleAfterTrap` 重算傷害並推進到
     *   傷害階段。
     * - `undefined`：這次翻牌與戰鬥無關（主要階段的技能／道具）。
     */
    battleContinuation?: BattleContinuation
  } | null
  pendingOptionalCostAttack?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    cost: AbilityCost
    effects: CardEffect[]
    effectText: string
    sourceEnergy?: EnergyCost
  } | null
  pendingStageTrigger?: {
    playerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    effectText: string
    sourceKind?: 'stage' | 'cookie-skill'
    effects?: CardEffect[]
    sourceEnergy?: EnergyCost
  } | null
  /**
   * 技能/道具/場景卡多效果的逐步待處理效果鏈。中途若出現其他待處理決策
   * （pendingRefresh/pendingOnPlay 等）會保留此欄位，供之後恢復繼續執行剩餘效果。
   */
  pendingAbilityEffect?: {
    playerId: PlayerId
    sourcePlayerId: PlayerId
    sourceInstanceId: string
    sourceCardName?: string
    sourceKind: 'skill' | 'item' | 'stage' | 'trap'
    trigger?: 'activate' | 'on-play' | 'attacker-faint'
    effects: CardEffect[]
    effectIndex: number
    /**
     * 兩階段選擇的第一階段結算完且目標未昏厥時，停在
     * 此處等待玩家決定第二階段「選擇手牌放到該餅乾 HP 最上方」
     * （cycle-hp BS4-030 / hand-to-hp BS4-044）；為空時
     * `pendingAbilityEffect` 本身仍是活躍決策，`effectIndex` 不推進。
     */
    pendingPlace?: {
      targetInstanceId: string
    }
    /**
     * 效果鏈跑完後欠戰鬥流程什麼動作。由
     * `pendingRevealTopDeck.battleContinuation` 傳遞下來，語意與該欄位相同。
     */
    battleContinuation?: BattleContinuation
  }
  supportAreaDecreasedThisTurn?: Partial<Record<PlayerId, boolean>>
}

/**
 * 待處理決策結算完之後，欠戰鬥流程的動作。
 * 見 `GameState.pendingRevealTopDeck.battleContinuation`。
 */
export type BattleContinuation = 'finish' | 'after-trap'

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
  /**
   * 本次戰鬥昏厥餅乾的完整資訊。`faintedColors` 只留顏色，
   * 需要判斷擁有者或等級的延遲觸發（BS3-046）必須看這裡。
   */
  faintedCookies?: {
    playerId: PlayerId
    energyColor?: EnergyColor | 'wild'
    level: number
  }[]
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
    color?: EnergyColor
    anyFriendlyCookie?: boolean
    /** 對應 TrapCondition 的 minLevel；設定時改以 faintedCookies 判定擁有者與等級。 */
    minLevel?: number
    effects: CardEffect[]
  }
  /**
   * 非攻擊效果的逐一傷害序列。沿用既有傷害／FLIP state machine，
   * 但不開啟陷阱或攻擊後效果，並在所有已選目標完成後才收尾。
   */
  effectDamageSequence?: {
    remainingTargetInstanceIds: string[]
    damage: number
    afterCurrentDamageResolved?: boolean
  }
}

export interface PlayerSetup {
  id: PlayerId
  name: string
  deck: GameCard[]
}

export type Shuffle = (cards: GameCard[]) => GameCard[]
