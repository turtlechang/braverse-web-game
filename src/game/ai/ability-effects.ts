import { executeCardEffect, isEffectConditionMet, isEffectUntargeted } from '../effects'
import { asChooseOneEffect, expandChooseOne } from '../effects/choose-one'
import type { CardEffect, EffectContext, GameState, Shuffle } from '../types'
import type { AiEffectSelection } from './types'
import { chooseAiEffectMode } from './choose-one-mode'

export interface SimulatedAbilityEffects {
  effectTargets: string[][]
  effectSelections: AiEffectSelection[]
  aborted: boolean
  /**
   * AI 為每個「選擇一項」挑的模式，依遇到的先後順序記錄。
   * 呼叫端必須在正式送出 `resolve-ability-effect` 之前，
   * 依序送出同樣的 `resolve-choose-one`，兩邊的效果佇列才會一致。
   */
  chooseOneModes: number[]
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
  const chooseOneModes: number[] = []
  // 「選擇一項」會就地換成選定模式的效果，所以佇列必須是可改寫的複本。
  let queue: CardEffect[] = [...effects]

  for (let index = 0; index < queue.length; index += 1) {
    if (nextState.status !== 'playing') break
    const effect = queue[index]

    const chooseOne = asChooseOneEffect(effect)
    if (chooseOne) {
      const modeIndex = chooseAiEffectMode(nextState, context, chooseOne)
      chooseOneModes.push(modeIndex)
      queue = expandChooseOne(queue, index, modeIndex)
      // index 不前進，改由展開後的第一個效果接手這一輪。
      index -= 1
      continue
    }

    if (!isEffectConditionMet(nextState, context, effect)) {
      effectTargets.push([])
      continue
    }
    const targetIds = isEffectUntargeted(effect)
      ? []
      : chooseEffectTargets(nextState, context, effect)
    if (!isTargetCountSufficient(effect, targetIds)) {
      return { effectTargets, effectSelections, aborted: true, chooseOneModes }
    }
    nextState = executeCardEffect(nextState, context, effect, targetIds, shuffle)
    effectTargets.push(targetIds)
    effectSelections.push({ ...effectSelectionMeta, targetIds, effect })
    if (nextState.pendingRefresh || nextState.pendingOnPlay) break
  }

  return { effectTargets, effectSelections, aborted: false, chooseOneModes }
}
