import type {
  AbilityCost,
  CardEffect,
  EffectTargetSelector,
  GameCard,
  EnergyCost,
} from '../../game'
import type { OfficialCardRecord } from '../types'

/**
 * 來源卡面文字的語意角色。這些角色是稽核用的中介表示，不會取代
 * `CardEffect`，也不會直接被 UI 當成規則來源。
 */
export type CardClauseRole =
  | 'timing'
  | 'condition'
  | 'payment'
  | 'cost'
  | 'target'
  | 'effect'
  | 'then'
  | 'order'
  | 'unsupported'

export type CardTextSource = 'skill' | 'attack' | 'flip' | 'ability'

export interface CardClauseFragment {
  id: string
  source: CardTextSource
  text: string
  role: CardClauseRole
  start: number
  end: number
  confidence: 'exact' | 'pattern' | 'unknown'
  tokens: string[]
}

export interface ContractPayment {
  kind: 'energy' | 'source-energy' | 'alternate'
  energy: EnergyCost
  clauseIds: string[]
}

export interface ContractTiming {
  markers: string[]
  runtime?: {
    trigger?: string
    oncePerTurn?: boolean
    yourTurn?: boolean
  }
}

export interface ContractCost {
  kind:
    | 'energy'
    | 'discard-hand'
    | 'support-to-trash'
    | 'battle-to-trash'
    | 'battle-to-break'
    | 'hand-to-break'
    | 'support-to-hand'
    | 'trash-to-deck'
    | 'trash-to-deck-bottom'
    | 'self-to-trash'
    | 'self-to-break'
    | 'rest-source'
    | 'faint'
    | 'hp-to-trash'
    | 'move'
    | 'rest-cookie'
    | 'field-to-deck-bottom'
    | 'self-to-deck-bottom'
    | 'break-to-trash'
    | 'hand-to-deck-bottom'
    | 'battle-to-hand'
    | 'hp-to-hand'
    | 'trash-to-break'
    | 'reveal-hand'
    | 'deck-to-trash'
    | 'unknown'
  amount?: number
  clauseIds: string[]
  runtime?: Partial<AbilityCost>
}

export interface ContractTarget {
  selector: Partial<EffectTargetSelector>
  clauseIds: string[]
  zone?: 'battle' | 'hand' | 'support' | 'trash' | 'break' | 'deck' | 'stage'
  /** 來源文字沒有提供可安全推導的 selector 時，必須保留原因。 */
  unresolved?: string
}

export interface ContractResolutionStep {
  order: number
  role: 'effect' | 'then' | 'condition' | 'order'
  clauseIds: string[]
  runtimeKinds: string[]
}

export interface CardBehaviorContract {
  schemaVersion: 1
  cardId: string
  baseCardId: string
  sourceHash: string
  source: {
    cardNumber: string
    type: OfficialCardRecord['type']
    segments: Partial<Record<CardTextSource, string>>
  }
  timing: ContractTiming
  clauses: CardClauseFragment[]
  payments: ContractPayment[]
  costs: ContractCost[]
  targets: ContractTarget[]
  steps: ContractResolutionStep[]
  status: 'verified' | 'needs-review' | 'blocked'
  blockers: string[]
}

export interface RuntimeCardEvidence {
  card: GameCard | null
  effects: CardEffect[]
  skill?: {
    trigger?: string
    oncePerTurn?: boolean
    oncePerGame?: boolean
    yourTurn?: boolean
    restSource?: boolean
    cost?: AbilityCost
    sourceEnergy?: EnergyCost
    effects?: CardEffect[]
  }
  attackEffects?: CardEffect[]
  flip?: {
    cost?: AbilityCost
    effects?: CardEffect[]
  }
  ability?: {
    cost?: AbilityCost
    restSource?: boolean
    effects?: CardEffect[]
  }
  unsupportedReason?: string
}

export interface CardBehaviorAudit {
  contract: CardBehaviorContract
  runtime: {
    effectKinds: string[]
    targetSelectors: Partial<EffectTargetSelector>[]
    energyCosts: EnergyCost[]
    abilityCostKeys: string[]
    timing?: ContractTiming['runtime']
  }
  checks: {
    sourceHashStable: boolean
    paymentCovered: boolean
    costCovered: boolean
    targetCovered: boolean
    resolutionOrderCovered: boolean
    timingCovered: boolean
  }
  errors: string[]
}
