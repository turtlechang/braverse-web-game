import type { AbilityCost, EffectTargetSelector, PlayerId } from './types'
import type { PendingDecision } from './commands'

export type DecisionDescriptorStepKind = 'payment' | 'cost' | 'target' | 'order' | 'resolve'

export interface DecisionDescriptorStep {
  id: string
  kind: DecisionDescriptorStepKind
  required: boolean
  min?: number
  max?: number
  candidateIds: string[]
  selector?: Partial<EffectTargetSelector>
  cost?: AbilityCost
  commandKinds: string[]
  label: string
}
export interface DecisionDescriptor {
  decisionKind: PendingDecision['kind']
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  steps: DecisionDescriptorStep[]
  /** UI 只能顯示這些 action；實際合法性仍由 applyGameCommand 驗證。 */
  actionKinds: string[]
}

const sourceFields = (decision: PendingDecision) => ({
  playerId: decision.playerId,
  sourcePlayerId: decision.sourcePlayerId,
  sourceInstanceId: decision.sourceInstanceId,
  sourceCardName: 'sourceCardName' in decision ? decision.sourceCardName : '',
})

/**
 * 將規則層 pending decision 正規化成 UI／AI 共用的 descriptor。
 * descriptor 不包含私有牌面內容，也不產生 GameState 變更；候選 ID 必須由
 * 呼叫端以合法公開視角提供，最後仍由 `applyGameCommand` 再驗證一次。
 */
export const describePendingDecision = (
  decision: PendingDecision | null,
  candidateIds: readonly string[] = [],
): DecisionDescriptor | null => {
  if (!decision) return null
  const source = sourceFields(decision)
  const ids = [...candidateIds]
  switch (decision.kind) {
    case 'faint-effect':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'target-1', kind: 'target', required: decision.min > 0, min: decision.min, max: decision.max, candidateIds: ids, commandKinds: ['resolve-faint-effect'], label: '選擇昏厥效果目標' }],
        actionKinds: ['resolve-faint-effect'],
      }
    case 'after-damage-effect':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'target-1', kind: 'target', required: decision.min > 0, min: decision.min, max: decision.max, candidateIds: ids, commandKinds: ['resolve-after-damage-effect'], label: '選擇攻擊後效果目標' }],
        actionKinds: ['resolve-after-damage-effect'],
      }
    case 'optional-cost-attack':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'payment-1', kind: 'payment', required: false, candidateIds: ids, cost: decision.cost, commandKinds: ['resolve-optional-cost-attack'], label: '選擇支付代價或略過' }],
        actionKinds: ['resolve-optional-cost-attack'],
      }
    case 'effect-order':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'order-1', kind: 'order', required: true, min: decision.items.length, max: decision.items.length, candidateIds: decision.items.map((item) => item.id), commandKinds: ['resolve-effect-order'], label: '排列效果結算順序' }],
        actionKinds: ['resolve-effect-order'],
      }
    case 'draw-up-to':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'resolve-1', kind: 'resolve', required: false, min: 0, max: decision.max, candidateIds: [], commandKinds: ['resolve-draw-up-to'], label: `抽最多 ${decision.max} 張牌` }],
        actionKinds: ['resolve-draw-up-to'],
      }
    case 'stage-trigger':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'resolve-1', kind: 'resolve', required: false, candidateIds: [], commandKinds: ['resolve-stage-trigger'], label: '發動場景效果或略過' }],
        actionKinds: ['resolve-stage-trigger'],
      }
    case 'opponent-hand-discard':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'target-1', kind: 'target', required: true, min: decision.count, max: decision.count, candidateIds: ids, commandKinds: ['resolve-opponent-hand-discard'], label: `選擇 ${decision.count} 張手牌` }],
        actionKinds: ['resolve-opponent-hand-discard'],
      }
    case 'opponent-rest-support':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'target-1', kind: 'target', required: true, min: decision.count, max: decision.count, candidateIds: ids, commandKinds: ['resolve-opponent-rest-support'], label: `選擇 ${decision.count} 張支援卡橫置` }],
        actionKinds: ['resolve-opponent-rest-support'],
      }
    case 'inspect-deck':
    case 'reveal-top-deck':
    case 'place-hand-hp':
    case 'reorder-hp':
      return {
        ...source,
        decisionKind: decision.kind,
        steps: [{ id: 'resolve-1', kind: decision.kind === 'reorder-hp' ? 'order' : 'resolve', required: false, candidateIds: ids, commandKinds: [`resolve-${decision.kind}`], label: '依規則層提示完成選擇' }],
        actionKinds: [`resolve-${decision.kind}`],
      }
  }
}
