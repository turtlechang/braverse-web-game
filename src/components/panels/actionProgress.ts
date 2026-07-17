import type { PublicIntentProgressStep } from '../../net/onlineProtocol'

export type ActionProgressStage =
  | 'declare'
  | 'payment'
  | 'cost'
  | 'target'
  | 'response'
  | 'resolve'

export interface ActionProgressOptions {
  active: ActionProgressStage
  hasPayment?: boolean
  hasCost?: boolean
  hasTarget?: boolean
}

const labels: Record<'declare' | 'payment' | 'cost' | 'target' | 'resolve', string> = {
  declare: '宣告',
  payment: '能量',
  cost: '代價',
  target: '目標',
  resolve: '結算',
}

const order = ['declare', 'payment', 'cost', 'target', 'resolve'] as const

/**
 * 對戰提示共用的五步驟進度。沒有費用、代價或目標的效果會直接略過該步，
 * 讓玩家看到的流程與實際導引式 EffectPanel 一致。
 */
export const buildActionProgress = ({
  active,
  hasPayment = true,
  hasCost = true,
  hasTarget = true,
}: ActionProgressOptions): PublicIntentProgressStep[] => {
  const visible = new Set<string>(['declare', 'resolve'])
  if (hasPayment) visible.add('payment')
  if (hasCost) visible.add('cost')
  if (hasTarget) visible.add('target')

  const activeIndex = active === 'response' ? order.indexOf('resolve') : order.indexOf(active)

  return order
    .filter((key) => visible.has(key))
    .map((key) => {
      const index = order.indexOf(key)
      const state =
        index < activeIndex
          ? 'done'
          : index === activeIndex
            ? 'active'
            : 'pending'
      return {
        key,
        label: active === 'response' && key === 'resolve' ? '回應' : labels[key],
        state,
      }
    })
}
