import { executeCardEffect, isEffectConditionMet, isEffectUntargeted } from '../effects'
import type { CardEffect, EffectContext, GameState, Shuffle } from '../types'
import type { AiEffectSelection } from './types'

export interface SimulatedAbilityEffects {
  effectTargets: string[][]
  effectSelections: AiEffectSelection[]
  aborted: boolean
}

/**
 * 模擬 AI 逐步選擇效果目標並執行，迴圈骨架必須與 `commands.ts` 的
 * `executeAbilityEffects` 保持一致（即時 `isEffectConditionMet` 重新檢查、
 * 遇 pendingRefresh/pendingOnPlay 即中斷），確保這裡算出的 `effectTargets`
 * 之後交給 `applyGameCommand` 正式執行時會得到相同結果（`executeCardEffect`
 * 為純函式，相同起始 state + 相同 targetIds 序列必然重現相同結果）。
 *
 * `isTargetCountSufficient` 由呼叫端提供，需完整複製該卡牌類型（item／skill／
 * stage）原本「目標數不足時整個動作作廢」的判斷條件。
 */
export const simulateAbilityEffects = (
  state: GameState,
  context: EffectContext,
  effects: readonly CardEffect[],
  chooseEffectTargets: (
    state: GameState,
    context: EffectContext,
    effect: CardEffect,
  ) => string[],
  isTargetCountSufficient: (effect: CardEffect, targetIds: string[]) => boolean,
  effectSelectionMeta: { sourceInstanceId: string; paymentIds: string[] },
  shuffle?: Shuffle,
): SimulatedAbilityEffects => {
  let nextState = state
  const effectTargets: string[][] = []
  const effectSelections: AiEffectSelection[] = []

  for (let index = 0; index < effects.length; index += 1) {
    if (nextState.status !== 'playing') break
    const effect = effects[index]
    if (!isEffectConditionMet(nextState, context, effect)) {
      effectTargets.push([])
      continue
    }
    const targetIds = isEffectUntargeted(effect)
      ? []
      : chooseEffectTargets(nextState, context, effect)
    if (!isTargetCountSufficient(effect, targetIds)) {
      return { effectTargets, effectSelections, aborted: true }
    }
    nextState = executeCardEffect(nextState, context, effect, targetIds, shuffle)
    effectTargets.push(targetIds)
    effectSelections.push({ ...effectSelectionMeta, targetIds, effect })
    if (nextState.pendingRefresh || nextState.pendingOnPlay) break
  }

  return { effectTargets, effectSelections, aborted: false }
}
