import { GameRuleError } from '../errors'
import type { CardEffect, ChooseOneEffect } from '../types'

export const asChooseOneEffect = (
  effect: CardEffect | undefined,
): ChooseOneEffect | null =>
  effect?.kind === 'choose-one' ? effect : null

/**
 * 把 `choose-one` 就地換成選定模式的效果，`effectIndex` 維持不變，
 * 讓既有的效果佇列走訪自然接續到該模式的第一個效果，
 * 各子效果也照常各自走目標選取流程。
 *
 * 本機 UI、線上 UI、指令層與 AI 都必須用這一份展開邏輯，
 * 否則四邊對「接下來要處理哪個效果」的認知會分歧。
 */
export const expandChooseOne = (
  effects: readonly CardEffect[],
  effectIndex: number,
  modeIndex: number,
): CardEffect[] => {
  const effect = asChooseOneEffect(effects[effectIndex])
  if (!effect) {
    throw new GameRuleError('目前的效果不是「選擇一項」。')
  }

  const mode = effect.modes[modeIndex]
  if (!mode) {
    throw new GameRuleError('選擇的項目不存在。')
  }

  return [
    ...effects.slice(0, effectIndex),
    ...mode.effects,
    ...effects.slice(effectIndex + 1),
  ]
}

/**
 * 依序展開佇列中的每個 `choose-one`。供「開始使用能力」的指令在建立
 * `pendingAbilityEffect` 之前，把 UI 已經替玩家決定好的模式套用進去。
 */
export const expandChooseOneSequence = (
  effects: readonly CardEffect[],
  modeIndexes: readonly number[] | undefined,
): CardEffect[] => {
  let queue: CardEffect[] = [...effects]
  for (const modeIndex of modeIndexes ?? []) {
    const index = queue.findIndex((effect) => effect.kind === 'choose-one')
    if (index === -1) break
    queue = expandChooseOne(queue, index, modeIndex)
  }
  return queue
}
