import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  createSeededShuffle,
  replayCommandLog,
  simulateAiMatch,
  simulateAiMatchDetailed,
} from '.'

/**
 * R3 回歸測試：AI 的 play-item／activate-skill／activate-stage 現在透過
 * `applyGameCommand` 執行（見 src/game/ai.ts、src/game/ai/turn-handler.ts），
 * commandLog 內的 `effectTargets` 必須完整到足以讓 `replayCommandLog` 從初始
 * state 重播出與實際對局完全相同的終局。種子 `red`/3 在合理行動數內會自然
 * 觸發技能／道具發動。`takeAiStep` 會把同一個 step seed 傳給技能、物品、
 * 場景與 Refresh，因而相同牌組與 seed 必須產生相同的 commandLog 與終局狀態。
 */
describe('AI 對局重播忠實度（R3）', () => {
  it('AI 對局的 commandLog 可經 replayCommandLog 重播出相同終局狀態', () => {
    const seed = 3
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

  it('BS4 benchmark 對局以相同 seed 重跑時完全一致', () => {
    const seed = 20260803
    const run = () =>
      simulateAiMatchDetailed(
        createDemoGame(seed, {
          player: 'bs4-red-fire-spirit',
          ai: 'bs4-purple-moonlight',
        }),
        2500,
        {
          levels: { 'player-one': 4, 'player-two': 4 },
          seed,
        },
      )

    const first = run()
    const second = run()

    expect(first.stuck).toBe(false)
    expect(second.stuck).toBe(false)
    expect(first.error).toBeNull()
    expect(second.error).toBeNull()
    expect(JSON.stringify(second.state)).toBe(JSON.stringify(first.state))
  })
})
