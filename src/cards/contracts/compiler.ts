import type { GameCard } from '../../game'
import type { DecisionDescriptorStep } from '../../game/decision-descriptor'
import { convertOfficialCardToGameCard } from '../official-card-adapter'
import type { OfficialCardRecord } from '../types'
import { analyzeOfficialCardBehavior } from './ledger'
import type {
  CardBehaviorAudit,
  CardBehaviorContract,
  CardTextSource,
  ContractCost,
  ContractPayment,
  ContractTarget,
} from './types'

export type ContractDecisionStepKind = 'payment' | 'cost' | 'target' | 'order' | 'resolve'

export interface ContractDecisionStep {
  id: string
  kind: ContractDecisionStepKind
  source: CardTextSource | 'contract'
  clauseIds: string[]
  required: boolean
  min?: number
  max?: number
  selector?: ContractTarget['selector']
  payment?: ContractPayment
  cost?: ContractCost
  label: string
}
export interface CompiledCardBehavior {
  cardId: string
  baseCardId: string
  status: CardBehaviorContract['status']
  blockers: string[]
  audit: CardBehaviorAudit
  steps: ContractDecisionStep[]
  /** 共用 DecisionDescriptor 的 shadow 片段；候選仍須由 GameState 編譯。 */
  decisionSteps: DecisionDescriptorStep[]
  /** 只有 descriptor 通過後才可交給規則層產生 GameCommand。 */
  executable: boolean
  gameCard: GameCard | null
}

const contractCommandKinds = (kind: ContractDecisionStepKind): string[] => {
  if (kind === 'payment' || kind === 'cost') {
    return ['begin-activate-skill', 'begin-play-item', 'begin-activate-stage']
  }
  if (kind === 'target') return ['resolve-ability-effect']
  return ['resolve-ability-effect']
}

/**
 * 把官方文字契約的步驟投影到共用 descriptor step。這個投影刻意不填
 * candidateIds：契約沒有合法 GameState 視角，任何候選都必須稍後由
 * `compileEffectDecisionDescriptor`／`compilePendingDecisionDescriptor`
 * 使用規則層 helper 產生。
 */
export const compileContractDecisionSteps = (
  steps: readonly ContractDecisionStep[],
): DecisionDescriptorStep[] =>
  steps.map((step) => ({
    id: step.id,
    kind: step.kind,
    required: step.required,
    ...(step.min !== undefined ? { min: step.min } : {}),
    ...(step.max !== undefined ? { max: step.max } : {}),
    candidateIds: [],
    candidateSource: 'provided',
    ...(step.selector ? { selector: step.selector } : {}),
    ...(step.payment ? { payment: step.payment.energy } : {}),
    ...(step.cost?.runtime ? { cost: step.cost.runtime as import('../../game').AbilityCost } : {}),
    clauseIds: step.clauseIds,
    commandKinds: contractCommandKinds(step.kind),
    label: step.label,
  }))

const paymentLabel = (payment: ContractPayment): string =>
  payment.kind === 'source-energy' ? '支付來源能量' : '支付能量'

const costLabel = (cost: ContractCost): string => {
  if (cost.kind === 'unknown') return '未辨識代價（需人工覆核）'
  if (cost.amount === undefined) return `支付${cost.kind}`
  return `支付${cost.amount} 張${cost.kind}`
}

/**
 * 將 shadow contract 編譯成 UI／規則層可以共用的步驟描述。
 *
 * 這個 bridge 目前是唯讀且保守的：`executable=false` 時不得直接執行，
 * 呼叫端必須回到既有規則流程並顯示 blocker。真正的候選卡牌仍由規則層
 * 依 `GameState` 產生，descriptor 不會偷看牌庫或手牌。
 */
export const compileCardBehaviorContract = (
  record: OfficialCardRecord,
  runtimeCard?: GameCard | null,
): CompiledCardBehavior => {
  const audit = analyzeOfficialCardBehavior(record, runtimeCard)
  const { contract } = audit
  const steps: ContractDecisionStep[] = []
  for (const payment of contract.payments) {
    steps.push({
      id: `payment-${steps.length + 1}`,
      kind: 'payment',
      source: contract.clauses.find((clause) => payment.clauseIds.includes(clause.id))?.source ?? 'contract',
      clauseIds: payment.clauseIds,
      required: true,
      payment,
      label: paymentLabel(payment),
    })
  }
  for (const cost of contract.costs) {
    steps.push({
      id: `cost-${steps.length + 1}`,
      kind: 'cost',
      source: contract.clauses.find((clause) => cost.clauseIds.includes(clause.id))?.source ?? 'contract',
      clauseIds: cost.clauseIds,
      required: cost.amount !== 0,
      cost,
      label: costLabel(cost),
    })
  }
  for (const target of contract.targets) {
    steps.push({
      id: `target-${steps.length + 1}`,
      kind: 'target',
      source: contract.clauses.find((clause) => target.clauseIds.includes(clause.id))?.source ?? 'contract',
      clauseIds: target.clauseIds,
      required: (target.selector.min ?? 0) > 0,
      min: target.selector.min,
      max: target.selector.max,
      selector: target.selector,
      label: `選擇目標（${target.selector.min ?? 0}–${target.selector.max ?? 0}）`,
    })
  }
  for (const resolution of contract.steps) {
    steps.push({
      id: `resolve-${resolution.order + 1}`,
      kind: resolution.role === 'then' ? 'order' : 'resolve',
      source: contract.clauses.find((clause) => resolution.clauseIds.includes(clause.id))?.source ?? 'contract',
      clauseIds: resolution.clauseIds,
      required: true,
      label: resolution.role === 'then' ? '依序結算 Then' : '結算效果',
    })
  }
  const conversion = runtimeCard === undefined ? convertOfficialCardToGameCard(record) : null
  return {
    cardId: contract.cardId,
    baseCardId: contract.baseCardId,
    status: contract.status,
    blockers: audit.errors,
    audit,
    steps,
    decisionSteps: compileContractDecisionSteps(steps),
    executable: contract.status === 'verified' && audit.errors.length === 0,
    gameCard: runtimeCard === undefined && conversion?.status === 'converted' ? conversion.gameCard : runtimeCard ?? null,
  }
}
