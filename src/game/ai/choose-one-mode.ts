import { isChooseOneModePlayable } from '../effects/choose-one'
import type {
  ChooseOneEffect,
  EffectContext,
  GameState,
} from '../types'

/**
 * 模式可不可行：所有子效果的條件都成立，且需要選卡的子效果都湊得出最低張數。
 * 例如 BS3-068 的第二個模式要丟 2 張支援卡，支援區不足時就不能選。
 */
/**
 * AI 的「選擇一項」決策：優先挑最後一個可行的模式。
 * 官方卡面把代價較高、效益也較高的選項排在後面（BS3-068 的全體傷害在第二項），
 * 湊不齊代價時才退回前面比較保守的模式，最後保底選第 0 項。
 */
export const chooseAiEffectMode = (
  state: GameState,
  context: EffectContext,
  effect: ChooseOneEffect,
  preferredModeIndices: readonly number[] = [],
): number => {
  for (const index of preferredModeIndices) {
    if (
      index >= 0 &&
      index < effect.modes.length &&
      isChooseOneModePlayable(state, context, effect.modes[index].effects)
    ) {
      return index
    }
  }
  for (let index = effect.modes.length - 1; index >= 0; index -= 1) {
    if (isChooseOneModePlayable(state, context, effect.modes[index].effects)) {
      return index
    }
  }
  return 0
}
