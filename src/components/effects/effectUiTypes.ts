import type {
  CardEffect,
  CardSkill,
  EffectContext,
  GameCard,
  SkillTrigger,
} from '../../game'

export interface PendingEffect {
  sourceCard: GameCard
  context: EffectContext
  skill: CardSkill
  trigger: SkillTrigger
  effects: CardEffect[]
  effectIndex: number
  selectedTargetIds: string[]
  selectedPaymentIds: string[]
  selectedCostSupportToTrashIds: string[]
  selectedDiscardHandIds: string[]
  selectedTrashBattleCookieIds: string[]
  /** 未指定時視為空陣列；只有帶棄牌區代價的技能會用到。 */
  selectedTrashToDeckBottomIds?: string[]
  skillActivated: boolean
  optional: boolean
  triggerLabel: string
  sourceKind: 'cookie' | 'item' | 'stage' | 'attack'
  /**
   * 玩家為「選擇一項」挑過的模式，依遇到的先後順序累積。
   * `effects` 已就地展開，這份紀錄是要讓稍後的 `begin-*` 指令
   * 在規則層重建出同一條效果佇列。
   */
  chooseOneModes?: number[]
}
