import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  createSeededShuffle,
  replayCommandLog,
  simulateAiMatch,
} from '.'

/**
 * R3 回歸測試：AI 的 play-item／activate-skill／activate-stage 現在透過
 * `applyGameCommand` 執行（見 src/game/ai.ts、src/game/ai/turn-handler.ts），
 * commandLog 內的 `effectTargets` 必須完整到足以讓 `replayCommandLog` 從初始
 * state 重播出與實際對局完全相同的終局。種子 `red`/1 在合理行動數內會自然
 * 觸發技能／道具發動，且不觸發 `refresh-deck`（其洗牌預設不可重播，屬既有、
 * 範圍外的限制，見 docs/known-risks.md）。
 */
describe('AI 對局重播忠實度（R3）', () => {
  it('AI 對局的 commandLog 可經 replayCommandLog 重播出相同終局狀態', () => {
    const seed = 1
    const levels = { 'player-one': 3, 'player-two': 3 } as const

    const liveResult = simulateAiMatch(createDemoGame(seed, 'red'), 300, {
      levels,
      seed,
    })

    expect(liveResult.stuck).toBe(false)
    expect(liveResult.error).toBeNull()

    const log = liveResult.state.commandLog ?? []
    const kinds = log.map((entry) => entry.commandKind)
    expect(kinds).toContain('activate-skill')
    expect(kinds).not.toContain('refresh-deck')

    const replayed = replayCommandLog(createDemoGame(seed, 'red'), log, {
      shuffle: createSeededShuffle(seed),
    })

    expect(JSON.stringify(replayed)).toBe(JSON.stringify(liveResult.state))
  })
})
