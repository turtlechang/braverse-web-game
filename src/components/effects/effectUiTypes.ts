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
  skillActivated: boolean
  optional: boolean
  triggerLabel: string
  sourceKind: 'cookie' | 'item' | 'stage' | 'attack'
}
