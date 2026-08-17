import {
  executeCardEffect,
  getEffectTargetCandidatesForEffect,
  isEffectConditionMet,
  isEffectUntargeted,
  requiresTargetSelection,
} from '../effects'
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
  chooseEffectMode?: (
    state: GameState,
    context: EffectContext,
    effect: Extract<CardEffect, { kind: 'choose-one' }>,
  ) => number,
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
      const modeIndex = chooseEffectMode
        ? chooseEffectMode(nextState, context, chooseOne)
        : chooseAiEffectMode(nextState, context, chooseOne)
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
    // 與 commands.executeAbilityEffects 一致：只有緊接著 equip-source 的
    // 選目標效果，在沒有合法候選時才整段中止（官方 Q&A 只針對 BS3-019 這種
    // 「Select…Then equip」的靈魂果醬寫法）；動作本身仍成立（費用已付、卡已
    // 進棄牌），故 aborted 維持 false。不能廣泛套用到任一效果——後面若接的是
    // 彼此獨立的效果（例如 BS3-081「傷害，然後把來源送回牌庫頂」），對手沒有
    // 合法傷害目標不代表後面的自身效果也不該執行。兩邊的判斷必須同步，否則
    // AI 這裡算出的「提前中止」效果目標陣列，交給 commands.ts 執行時因為沒有
    // 中止而拿到不足的目標數，會直接丟錯。
    if (
      queue[index + 1]?.kind === 'equip-source' &&
      requiresTargetSelection(effect) &&
      getEffectTargetCandidatesForEffect(nextState, context, effect).length === 0
    ) {
      effectTargets.push([])
      break
    }
    const usesCardSelection =
      effect.kind === 'break-to-battle' ||
      effect.kind === 'support-to-battle' ||
      effect.kind === 'hand-to-break' ||
      effect.kind === 'break-to-hand'
    // Composite effects such as BS3-113's `trash-to-deck-all` are untargeted
    // at the outer level but carry a sequential damage-all `Then` branch that
    // still requires every legal battle target in resolution order. Keep the
    // nested target list in the same command payload instead of discarding it
    // with the ordinary untargeted-effect path.
    const hasNestedTargetSelection =
      effect.kind === 'trash-to-deck-all' &&
      effect.thenEffects?.some(
        (thenEffect) =>
          thenEffect.kind === 'damage-all' && thenEffect.sequential === true,
      ) === true
    const targetIds =
      isEffectUntargeted(effect) && !usesCardSelection && !hasNestedTargetSelection
      ? []
      : chooseEffectTargets(nextState, context, effect)
    if (!isTargetCountSufficient(effect, targetIds)) {
      return { effectTargets, effectSelections, aborted: true, chooseOneModes }
    }
    nextState = executeCardEffect(nextState, context, effect, targetIds, shuffle)
    effectTargets.push(targetIds)
    effectSelections.push({ ...effectSelectionMeta, targetIds, effect })
    // 含 FLIP 的效果傷害會暫停在 battle/FLIP state machine，正式指令鏈
    // 必須先完成這段序列，不能讓模擬器繼續把後續效果當成同步結算。
    if (nextState.pendingBattle?.effectDamageSequence) break
    if (nextState.pendingRefresh || nextState.pendingOnPlay) break
    const nextEffect = queue[index + 1]
    if (
      nextEffect?.kind === 'equip-source' &&
      !nextState.players[context.sourcePlayerId].battleArea.some(
        (c) => c.card.id === nextEffect.requiredCookieId,
      )
    ) {
      index += 1
    }
  }

  return { effectTargets, effectSelections, aborted: false, chooseOneModes }
}
