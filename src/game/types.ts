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

export type SkillTrigger = 'activate' | 'on-play' | 'passive' | 'block' | 'opponent-attack'

/** 回合結束效果是在來源玩家自己的回合，或對手的回合結束時觸發。 */
export type EndPhaseScope = 'your-turn' | 'opponent-turn'

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
  /**
   * 「When this Cookie faints」整組技能可由持有者選擇是否發動。
   * 與單一 CardEffect 的 optional 不同，略過時會跳過同一觸發佇列的所有效果。
   */
  faintOptional?: boolean
  /** Alternate cost used by an official Special Play instruction. */
  specialPlayCost?: AbilityCost
  faint?: boolean
  endPhase?: boolean
  endPhaseScope?: EndPhaseScope
  afterDamage?: boolean
  /**
   * 整局只能發動一次（BS3-025）。官方釋疑：是每位玩家限定一次，即使同一玩家
   * 休息區有多張同名卡也共用這一次額度，因此 GameState.skillUsesThisGame
   * 記的是 `playerId:card.id`（同名卡共用），不是 card.instanceId。
   */
  oncePerGame?: boolean
  /** 技能來源在休息區時才能發動（BS3-025）；一般技能只看戰鬥區。 */
  fromBreakArea?: boolean
  fromTrashArea?: boolean
  fromSupportArea?: boolean
}

export interface CardAbility {
  cost: AbilityCost
  text: string
  effects: CardEffect[]
  /** 某些官方物品會在滿足回合內條件後改用另一組啟動費用。 */
  activationCostOverride?: {
    condition: 'friendly-cookie-fainted-this-turn'
    cost: AbilityCost
  }
}

export interface StageAbility extends CardAbility {
  placementCost: EnergyCost
  restSource: boolean
  triggered?: boolean
  /**
   * 「When your turn ends, ...」的被動回合結束觸發（BS5-066 Longan Palace）。
   * 由 `processEndPhaseEffects` 在回合結束階段自動結算，不需要玩家主動發動。
   */
  endPhase?: boolean
  endPhaseScope?: EndPhaseScope
  specialVictory?: SpecialVictoryCondition
}

export type CardKeyword = 'ancient' | 'soul-jam' | 'dragon' | 'arena'

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
  maxRemainingHp?: number
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
  /**
   * 指名卡名目標（BS5-014 的「your opponent's [Pitaya Dragon Cookie]」）。
   * 比對 runtime `cookie.card.name`，異畫變體共用同一張基礎卡名。
   */
  cardName?: string
  /**
   * 只允許技能代價（`hpToTrash`）剛選中的餅乾成為目標
   * （BS5-022 的「Place 1 card from the top of your LV.2 or higher Cookie's
   * HP into the trash. During this turn, that Cookie gains +1 attack damage.」）。
   */
  costSelected?: boolean
  /**
   * 只允許「沒有技能」的餅乾成為目標（BS5-036 Milk Cookie 的「LV.1 Cookie
   * ... that does not have Skill」）。技能存在與否以轉接層產出的
   * `CookieCard.skill` 為準（沒有技能文字的餅乾為 `null`）。
   */
  noSkillOnly?: boolean
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
  keyword?: CardKeyword
  minLevel?: number
  maxLevel?: number
}

export interface TrashKeywordCountAtLeastCondition {
  kind: 'trash-keyword-count-at-least'
  keyword: CardKeyword
  count: number
}

export interface SourceHpReducedThisTurnCondition {
  kind: 'source-hp-reduced-this-turn'
}

export interface ArenaCookieDealtEffectDamageThisTurnCondition {
  kind: 'arena-cookie-dealt-effect-damage-this-turn'
}

export interface BirthdayCondition {
  kind: 'birthday'
}

export interface BreakAreaCardCountAtLeastCondition {
  kind: 'break-area-card-count-at-least'
  side: EffectTargetSide
  count: number
  keyword?: CardKeyword
  minLevel?: number
  maxLevel?: number
}

export interface SupportCountLessThanOpponentCondition {
  kind: 'support-count-less-than-opponent'
  difference: number
}

export interface OpponentHandCountAtLeastCondition {
  kind: 'opponent-hand-count-at-least'
  count: number
}

export interface CookiesFaintedThisTurnAtLeastCondition {
  kind: 'cookies-fainted-this-turn-at-least'
  side: EffectTargetSide
  count: number
}

export interface SupportCardsTrashedThisTurnAtLeastCondition {
  kind: 'support-cards-trashed-this-turn-at-least'
  count: number
}

export interface ItemActivatedThisTurnCondition {
  kind: 'item-activated-this-turn'
}

export interface ArenaCookiePlacedInBreakThisTurnCondition {
  kind: 'arena-cookie-placed-in-break-this-turn'
}

export interface SourceHpAtMostCondition {
  kind: 'source-hp-at-most'
  amount: number
}

export interface BreakLevelAtMostCondition {
  kind: 'break-level-at-most'
  level: number
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

/** 本次攻擊宣告的目標，攻擊當下的剩餘 HP 卡數低於等於門檻（BS5-024 的「if the attacked Cookie's remaining HP is 2 or less」）。 */
export interface AttackTargetRemainingHpAtMostCondition {
  kind: 'attack-target-remaining-hp-at-most'
  amount: number
}

/** 來源玩家自己的餅乾在本回合內曾因效果增加過 HP（BS5-044 Ananas Dragon Cookie's Nest 的「if any of your Cookies gained HP」）。 */
export interface CookieGainedHpThisTurnCondition {
  kind: 'cookie-gained-hp-this-turn'
}

/** 來源玩家本回合曾有餅乾從棄牌區登場（BS6-107）。 */
export interface CookiePlayedFromTrashThisTurnCondition {
  kind: 'cookie-played-from-trash-this-turn'
}

/** 本次攻擊宣告的目標等級達到上限（BS4-009 的「if the attacked Cookie is LV.2 or lower」）。 */
export interface AttackTargetLevelAtMostCondition {
  kind: 'attack-target-level-at-most'
  level: number
}

/** 本次攻擊宣告的目標等級剛好等於門檻（BS5-012 的「if the attacked Cookie is LV.3」）。 */
export interface AttackTargetLevelEqualsCondition {
  kind: 'attack-target-level-equals'
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

export interface AnyOfCondition {
  kind: 'any-of'
  conditions: EffectCondition[]
}

/** 場上有指定卡名的餅乾（BS5-022 的「if [Pitaya Dragon Cookie] is in your battle area」）。 */
export interface BattleAreaHasNamedCookieCondition {
  kind: 'battle-area-has-named-cookie'
  side: EffectTargetSide
  name: string
  /** 「another」：不算來源自己。 */
  excludeSource?: boolean
}

/**
 * 技能代價（`hpToTrash`）剛被磨進棄牌區的最上方卡不是 Cookie
 * （BS5-016 的「If that card is a non-Cookie card」）。
 * 只認 `GameState.costRecord` 存在且其 `hpTrashTopCardType` 非 cookie；
 * 沒有 costRecord（例如由其他路徑發動）一律視為不成立。
 */
export interface LastHpTrashCardNonCookieCondition {
  kind: 'last-hp-trash-card-non-cookie'
}

/** 己方戰鬥區剩餘 HP 恰好等於門檻的餅乾張數達到數量（BS5-020 的「2 Cookies whose remaining HP is 1」）。 */
export interface BattleAreaRemainingHpCountAtLeastCondition {
  kind: 'battle-area-remaining-hp-count-at-least'
  side: EffectTargetSide
  remainingHp: number
  count: number
}

/** 己方戰鬥區餅乾張數不超過門檻（BS5-086 的「If there is 1 Cookie in your battle area」）。 */
export interface BattleAreaCountAtMostCondition {
  kind: 'battle-area-count-at-most'
  count: number
}

export type EffectCondition =
  | AllOfCondition
  | AnyOfCondition
  | BreakLevelCondition
  | OpponentTrashCountAtLeastCondition
  | SupportCountAtLeastCondition
  | SupportColorCountAtLeastCondition
  | SupportCountAtMostCondition
  | OpponentSupportCountAtLeastCondition
  | ActiveSupportCountAtLeastCondition
  | TrashColorCountAtLeastCondition
  | TrashKeywordCountAtLeastCondition
  | HandCountAtMostCondition
  | HandCountAtLeastCondition
  | SupportAreaDecreasedThisTurnCondition
  | OpponentHasCookieWithLevelCondition
  | AttackerLevelAtMostCondition
  | OpponentBattleAreaCookieCountCondition
  | BattleAreaHasCookieWithLevelCondition
  | BattleAreaHasColorCondition
  | BreakAreaHasCardCondition
  | BreakAreaCardCountAtLeastCondition
  | SupportCountLessThanOpponentCondition
  | OpponentHandCountAtLeastCondition
  | CookiesFaintedThisTurnAtLeastCondition
  | SupportCardsTrashedThisTurnAtLeastCondition
  | ItemActivatedThisTurnCondition
  | ArenaCookiePlacedInBreakThisTurnCondition
  | SourceHpAtMostCondition
  | BreakLevelAtMostCondition
  | TrashCountAtLeastCondition
  | TrashCountAtMostCondition
  | TrashFlipCountAtLeastCondition
  | OpponentBreakLevelAtMostCondition
  | SourceHpLessThanCondition
  | SourceHpAtLeastCondition
  | SourceInBreakAreaCondition
  | OpponentCookieFaintedInCurrentBattleCondition
  | AttackTargetRemainingHpAtLeastCondition
  | AttackTargetRemainingHpAtMostCondition
  | CookieGainedHpThisTurnCondition
  | CookiePlayedFromTrashThisTurnCondition
  | AttackTargetLevelAtMostCondition
  | AttackTargetLevelEqualsCondition
  | SupportKeywordAtLeastCondition
  | DistinctNamedFamilyCountCondition
  | AnyBattleAreaHasBlockerCondition
  | OpponentBattleAreaHasNoBlockerCondition
  | BreakLevelHigherThanOpponentCondition
  | BattleAreaHasNamedCookieCondition
  | LastHpTrashCardNonCookieCondition
  | BattleAreaRemainingHpCountAtLeastCondition
  | BattleAreaCountAtMostCondition
  | SourceHpReducedThisTurnCondition
  | ArenaCookieDealtEffectDamageThisTurnCondition
  | BirthdayCondition

export interface DamageEffect {
  kind: 'damage'
  amount: number
  target: EffectTargetSelector
  condition?: EffectCondition
}

/**
 * 讓目標餅乾昏厥（BS5-036 Milk Cookie 的「Make that Cookie faint」）。
 * 走與傷害相同的昏厥流程：餅乾卡移至休息區、HP 卡移至棄牌區、觸發
 * 目標的 faint 技能（若有的話）、補位與勝負判定。
 */
export interface MakeFaintEffect {
  kind: 'make-faint'
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
  /** Resolve an optional draw only when this effect's selected target meets the HP check. */
  thenDrawUpToIfTargetRemainingHp?: {
    remainingHp: number
    max: number
  }
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
  /** 指定卡牌不得作為休息區目標（例如 BS6-091 的 Schneeball Cookie）。 */
  excludeCardId?: string
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
  /** Gain `amount` HP for each matching Cookie in the source player's break area. */
  perBreakCard?: {
    minLevel?: number
    exactLevel?: number
    energyColor?: EnergyColor
  }
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

/** Prevent the defending player from activating Trap cards during this battle. */
export interface DisableTrapEffect {
  kind: 'disable-traps'
  duration: 'current-battle'
  condition?: EffectCondition
}

/** While the source is in battle, opponents cannot move Cookies out of battle by effects. */
export interface PreventOpponentBattleMovementEffect {
  kind: 'prevent-opponent-battle-movement'
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

/** View every HP card of a selected Cookie, then place the same cards back in any order. */
export interface ReorderHpEffect {
  kind: 'reorder-hp'
  target: EffectTargetSelector
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
  /** "Play up to N" permits resolving with no selected card. */
  optional?: boolean
  exactLevel?: number
  maxLevel?: number
  /** Restricts the printed HP value of the Cookie card in the trash. */
  maxHp?: number
  energyColor?: EnergyColor
  keyword?: CardKeyword
  condition?: EffectCondition
}

export interface SupportToHandEffect {
  kind: 'support-to-hand'
  amount: number
  /** "Select any number" permits selecting every matching support card. */
  anyNumber?: boolean
  /** Choose these cards to remain in support, then return every other eligible card. */
  keepCount?: number
  /** Restricts returned support cards to a printed card type. */
  cardType?: GameCard['type']
  energyColor?: EnergyColor
  maxLevel?: number
  condition?: EffectCondition
  optional?: boolean
}

export interface HandToSupportEffect {
  kind: 'hand-to-support'
  amount: number
  rested?: boolean
  energyColor?: EnergyColor
  optional?: boolean
  condition?: EffectCondition
}

export interface OpponentDiscardHandEffect {
  kind: 'opponent-discard-hand'
  count: number
  /** 對手選中的手牌去向；未指定時維持原本的棄牌區語意。 */
  destination?: 'trash' | 'deck-top' | 'deck-bottom'
  condition?: EffectCondition
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
  /** When false, the declared number of rested support cards must be chosen. */
  optional?: boolean
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
  keyword?: CardKeyword
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
  condition?: EffectCondition
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

/** 依自己休息區中符合等級的餅乾數量決定抽牌上限（BS6-030）。 */
export interface DrawUpToBreakCookieCountEffect {
  kind: 'draw-up-to-break-cookie-count'
  minLevel?: number
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
  requiredCookieId?: string
  requiredKeyword?: CardKeyword
  maxRemainingHp?: number
  /** 裝備成功後，只有符合此 HP 門檻才套用攻擊／減傷加成。 */
  bonusMaxRemainingHp?: number
  attackBonus?: number
  gainHp?: number
  damageReceivedReduction?: number
}

/** 未被選走的檢視卡去向；`bottom`／`top` 由玩家決定順序，`trash` 直接棄置。 */
export type InspectDeckRestDestination = 'bottom' | 'top' | 'trash'

export interface InspectDeckEffect {
  kind: 'inspect-deck'
  lookCount: number
  pickCount: number
  restDestination: InspectDeckRestDestination
  condition?: EffectCondition
  /** 被選走的卡去向；預設加入手牌，`battle` 代表直接登場（BS3-114）。 */
  pickDestination?: 'hand' | 'battle'
  filterColor?: EnergyColor
  /** 只有此類型的卡可被選走，例如 BS3-114 限定 Cookie。 */
  filterType?: GameCard['type']
  /** 官方文字的「up to」：可以一張都不選（BS3-114）。 */
  optionalPick?: boolean
  /**
   * 登場時附帶的額外 HP 卡張數（BS5-086 的「Play that Cookie with
   * +1 HP」）；只在 `pickDestination: 'battle'` 時有意義。
   */
  extraHp?: number
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
  condition?: EffectCondition
}

export interface ReturnToDeckBottomEffect {
  kind: 'return-to-deck-bottom'
  target: EffectTargetSelector
  condition?: EffectCondition
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

export interface HpToTrashAllEffect {
  kind: 'hp-to-trash-all'
  amount: number
  side: EffectTargetSide
  condition?: EffectCondition
}

export interface RestCookieEffect {
  kind: 'rest-cookie'
  target: EffectTargetSelector
  condition?: EffectCondition
}

export interface BreakSourceToTrashEffect {
  kind: 'break-source-to-trash'
  condition?: EffectCondition
}

export interface RevealHandEffect {
  kind: 'reveal-hand'
  amount: number
  keyword?: CardKeyword
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
  keyword?: CardKeyword
  maxLevel?: number
}

export interface TrashToDeckEffect {
  kind: 'trash-to-deck'
  max: number
  /** Minimum number of cards when the official text says a fixed amount. */
  min?: number
  excludeFlip?: boolean
  energyColor?: EnergyColor
  cookieOnly?: boolean
  keyword?: CardKeyword
  nonCookieOnly?: boolean
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
  keyword?: CardKeyword
}

/** 從自己支援區選餅乾登場戰鬥區（BS4-058），跟 break-to-battle 同一種形狀，只是來源區不同。 */
export interface SupportToBattleEffect {
  kind: 'support-to-battle'
  amount: number
  exactLevel?: number
  maxLevel?: number
  energyColor?: EnergyColor
  keyword?: CardKeyword
  condition?: EffectCondition
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
  condition?: EffectCondition
}

export interface FieldToDeckBottomAllEffect {
  kind: 'field-to-deck-bottom-all'
  maxLevel?: number
  minLevel?: number
}

/**
 * 攻擊後續效果／技能的「Then, when your turn ends, ...」（BS5-056／060）。
 * 執行時不立即結算，而是把內層效果存入 `pendingEndOfTurnEffects`，
 * 等到本回合結束階段（`processEndPhaseEffects`）才依序結算。
 */
export interface DeferredEndOfTurnEffect {
  kind: 'deferred-end-of-turn'
  effects: CardEffect[]
  condition?: EffectCondition
}

/**
 * 官方文字的「your opponent selects N active card(s) from their support
 * area. Rest that card.」（BS5-065）。選擇權在對手：由對手的支援區
 * （`activeOnly` 限定活躍卡）挑 N 張橫置。沒有合法候選時直接略過。
 */
export interface OpponentRestsSupportEffect {
  kind: 'opponent-rests-support'
  amount: number
  activeOnly?: boolean
  condition?: EffectCondition
}

/**
 * BS6-039: first trash one Cookie from the opponent's break area, then
 * optionally move an opponent battle Cookie exactly one level higher into break.
 * The second target is determined by the first selected card, so this remains a
 * single serialized effect instead of exposing an invalid static target selector.
 */
export interface OpponentBreakToTrashThenBattleToBreakEffect {
  kind: 'opponent-break-to-trash-then-battle-to-break'
  condition?: EffectCondition
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
  | DisableTrapEffect
  | PreventOpponentBattleMovementEffect
  | PreventEffectDamageEffect
  | ViewHpEffect
  | ReorderHpEffect
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
  | HpToTrashAllEffect
  | RestCookieEffect
  | BreakSourceToTrashEffect
  | RevealHandEffect
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
  | DrawUpToBreakCookieCountEffect
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
  | MakeFaintEffect
  | RestCookieEffect
  | DeferredEndOfTurnEffect
  | OpponentRestsSupportEffect
  | OpponentBreakToTrashThenBattleToBreakEffect

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
  | ReorderHpEffect
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
  | MakeFaintEffect
  | RestCookieEffect

export type AbilityCost = EnergyCost & {
  energy?: EnergyCost
  discardHand?: number
  discardHandColor?: EnergyColor
  discardHandKeyword?: CardKeyword
  discardHandHasFlip?: boolean
  /**
   * 「Discard 3 or more {B} cards.」（BS5-071）類代價：只要張數達到
   * `discardHand` 即可，玩家可棄更多；未設定時維持精確張數。
   */
  discardHandAtLeast?: boolean
  /** 「Discard your entire hand.」（BS5-083）：整副手牌全部進棄牌區。 */
  discardAllHand?: boolean
  /** 限定棄置的手牌類型，例如「Discard 1 {R} Trap card」。 */
  discardHandType?: GameCard['type']
  supportToTrash?: number
  supportToHand?: number
  /** Optional restriction for support cards returned as a cost (for example, Cookie only). */
  supportToHandType?: GameCard['type']
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
  /** Return Cookies from the battle area to hand as an ability cost. */
  battleCookieToHand?: {
    count: number
    level?: number
    minLevel?: number
    maxLevel?: number
    energyColor?: EnergyColor
    sourceOnly?: boolean
    excludeSource?: boolean
  }
  /** 從自己的棄牌區將符合條件的餅乾放入休息區，作為替代代價。 */
  trashCookieToBreakArea?: {
    count: number
    hp?: number
    energyColor?: EnergyColor
    excludeFlip?: boolean
  }
  selfToBreakArea?: boolean
  selfToTrash?: boolean
  /**
   * 來源自己離開戰鬥區、放到自己牌庫最下方作為發動代價（BS4-077）。
   * 這不是卡牌效果，因此不受 BS6-010 的「效果移動」封鎖。
   */
  selfToDeckBottom?: boolean
  /**
   * 從棄牌區選指定條件的卡牌洗回牌庫作為代價（BS3-098）。
   * 與 `trashToDeckBottom` 不同，結算後會將選取卡牌與牌庫合併並洗牌。
   */
  trashToDeck?: {
    count: number
    energyColor?: EnergyColor
    excludeFlip?: boolean
    /** 限定只能選 Cookie（例如 BS5-094 的紫色 Cookie 代價）。 */
    cookieOnly?: boolean
    keyword?: CardKeyword
    nonCookieOnly?: boolean
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
  /**
   * 附著 HP 期間的連續 +1 HP（BS5-004／BS5-041／BS5-082／BS5-095 的
   * 「The Cookie with this card attached for HP gains +1 HP」）。
   * 不是一次性效果：只要這張卡還附著在目標餅乾的 HP，剩餘 HP 就 +1；
   * 卡離開 HP（被傷害、代價磨掉……）加成就消失。
   * 剩餘 HP 的計算一律以 `getCookieEffectiveHp`（helpers.ts）為準。
   */
  attachedHpBonus?: number
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
      /**
       * 陷阱擁有者的休息區至少有指定張數的餅乾（BS6-042）。
       * 這是「張數」而不是休息區 LV 合計，不能復用 break-level-at-least。
       */
      kind: 'break-area-card-count-at-least'
      count: number
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
  | {
      kind: 'battle-area-has-cookie-with-level'
      level: number
    }

export interface TrapAbility {
  text: string
  cost: AbilityCost
  /** 陷阱可選的替代支付方式；未指定時只使用 `cost`。 */
  alternativeCosts?: AbilityCost[]
  condition?: TrapCondition
  effects: CardEffect[]
}

export interface AttackModifier {
  sourceInstanceId: string
  targetInstanceId: string
  amount: number
  expiresAfterTurn: number | null
  /** Modifier is active only while the target's remaining HP is at most this value. */
  maxTargetRemainingHp?: number
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
  /** Modifier is active only while the target's remaining HP is at most this value. */
  maxTargetRemainingHp?: number
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
  /** 略過時跳過此來源本次昏厥觸發佇列的所有效果。 */
  optional?: boolean
  effect: CardEffect
  context: EffectContext
  /**
   * 觸發昏厥技能本身的手牌／支援區代價。這些代價必須在效果目標前
   * 完成，並與一般技能啟動共用同一套候選卡判定。
   */
  cost?: Pick<AbilityCost, 'discardHand' | 'discardHandColor' | 'discardHandType' | 'supportToTrash'>
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

/**
 * 官方文字的「your opponent selects N active card(s) from their support
 * area. Rest that card.」（BS5-065）。`playerId` 是必須做選擇的對手玩家，
 * 選定後由 `resolveOpponentRestSupport` 把對應支援卡橫置。
 */
export interface PendingOpponentRestSupport {
  playerId: PlayerId
  count: number
  activeOnly?: boolean
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
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
    origin?: 'hand' | 'trash' | 'support' | 'break'
  } | null
  pendingDrawUpTo?: {
    playerId: PlayerId
    max: number
    sourcePlayerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    /** 來源卡號，讓 UI／對戰紀錄能明確指出是哪一張卡的效果。 */
    sourceCardId?: string
    effectText?: string
    /** 觸發這次抽牌的條件（例如 P-059 的啟動支援卡數量）。 */
    condition?: EffectCondition
    afterEffects?: CardEffect[]
    afterEffectContext?: EffectContext
    afterEffectsRequireDraw?: boolean
  } | null
  effectDamagePreventedUntilTurn?: Record<string, number>
  cookiesFaintedThisTurn?: Record<PlayerId, number>
  supportCardsTrashedThisTurn?: Partial<Record<PlayerId, number>>
  arenaCookiesPlacedInBreakThisTurn?: Partial<Record<PlayerId, number>>
  itemsActivatedThisTurn?: Partial<Record<PlayerId, number>>
  cookiesHpReducedThisTurn?: Partial<Record<PlayerId, Record<string, boolean>>>
  arenaCookieDealtEffectDamageThisTurn?: Partial<Record<PlayerId, boolean>>
  isBirthday?: boolean
  pendingRefresh: {
    playerId: PlayerId
    remainingDraws: number
  } | null
  pendingBattle?: PendingBattle | null
  pendingFaintEffects?: PendingFaintEffect[]
  pendingAfterDamageEffects?: PendingAfterDamageEffect[]
  pendingEffectOrder?: PendingEffectOrder | null
  /**
   * 最近一次 `hpToTrash` 技能代價的結算紀錄，供接續的效果／條件讀取：
   * - `hpTrashCookieInstanceId`：被磨 HP 的餅乾（BS5-022 的「that Cookie」）。
   * - `hpTrashTopCardInstanceId`：實際被磨進棄牌區的 HP 卡，供 UI 與對戰紀錄顯示。
   * - `hpTrashTopCardType`：被磨進棄牌區的那張 HP 卡的類型（BS5-016 的
   *   「If that card is a non-Cookie card」）。
   * 僅在 `payAbilityCost` 支付 `hpToTrash` 時寫入；同一個命令鏈內由後續
   * 效果或條件消費，不跨回合保留。
   */
  costRecord?: {
    hpTrashCookieInstanceId?: string
    hpTrashTopCardInstanceId?: string
    hpTrashTopCardType?: GameCard['type']
  }
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
    extraHp?: number
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
   * 等待對手從自己支援區選卡橫置的決策（BS5-065 的「your opponent selects
   * 1 active card from their support area. Rest that card.」）。
   * 沒有合法候選時不建立，效果直接略過。
   */
  pendingOpponentRestSupport?: PendingOpponentRestSupport | null
  /**
   * 攻擊後續效果的「Then, when your turn ends, ...」（BS5-056／060）。
   * 攻擊結算時只排隊，回合結束階段由 `processEndPhaseEffects` 依序結算；
   * 內層效果需要選目標時照常走 `pendingAbilityEffect` 通道。
   */
  pendingEndOfTurnEffects?: {
    playerId: PlayerId
    sourcePlayerId: PlayerId
    sourceInstanceId: string
    sourceCardName: string
    effects: CardEffect[]
    effectIndex: number
  }[]
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
    trigger?: 'activate' | 'on-play' | 'passive' | 'attacker-faint'
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
    /** BS6-034: after choosing a Cookie, its complete HP pile must be reordered. */
    pendingReorderHp?: {
      targetPlayerId: PlayerId
      targetInstanceId: string
    }
    /** BS6-039: the trashed opponent break Cookie determines the next target level. */
    pendingOpponentBreakToTrashThenBattleToBreak?: {
      selectedBreakCardLevel: number
    }
    /**
     * 效果鏈跑完後欠戰鬥流程什麼動作。由
     * `pendingRevealTopDeck.battleContinuation` 傳遞下來，語意與該欄位相同。
     */
    battleContinuation?: BattleContinuation
  }
  supportAreaDecreasedThisTurn?: Partial<Record<PlayerId, boolean>>
  /** 各玩家本回合是否有餅乾因效果增加過 HP（BS5-044 的「if any of your Cookies gained HP」）。每回合開始時重置。 */
  cookiesGainedHpThisTurn?: Partial<Record<PlayerId, boolean>>
  /** 各玩家本回合是否曾從棄牌區讓餅乾登場（BS6-107）。每回合開始時重置。 */
  cookiesPlayedFromTrashThisTurn?: Partial<Record<PlayerId, boolean>>
}

/**
 * 待處理決策結算完之後，欠戰鬥流程的動作。
 * 見 `GameState.pendingRevealTopDeck.battleContinuation`。
 */
export type BattleContinuation = 'finish' | 'after-trap' | 'attack-effect'

/**
 * 效果傷害逐點結算完成後，原本被暫停的流程要如何接續。
 *
 * `ability-effect` 代表技能／物品／場景／陷阱佇列中的目前效果；
 * `attack-effect` 代表一般攻擊後效果；其餘兩項則是保留原戰鬥流程。
 */
export type EffectDamageContinuation =
  | 'ability-effect'
  | 'attack-effect'
  | 'finish-battle'
  | 'after-trap'

export interface EffectDamageTarget {
  playerId: PlayerId
  instanceId: string
  damage: number
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
  /** A current-battle effect, such as BS6-008, prevents the defender's Traps. */
  trapsDisabled?: boolean
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
    /** 目標可能跨玩家，或 split-damage 需要不同傷害量時使用。 */
    remainingTargets?: EffectDamageTarget[]
    /** 結算完這段效果傷害後，接回原本被暫停的流程。 */
    continuation?: EffectDamageContinuation
    /** 是否仍需保留建立序列前的外層 PendingBattle。 */
    resumeBattleAfterAbility?: boolean
  }
}

export interface PlayerSetup {
  id: PlayerId
  name: string
  deck: GameCard[]
}

export type Shuffle = (cards: GameCard[]) => GameCard[]
