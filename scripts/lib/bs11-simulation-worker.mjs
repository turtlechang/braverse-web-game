import { parentPort } from 'node:worker_threads'
import { tsImport } from 'tsx/esm/api'
const { createCustomDeckMatch, simulateAiMatchDetailed } = await tsImport('../../src/game/index.ts', import.meta.url)
parentPort.on('message', ({ id, input }) => {
  try {
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(input.seed, input.left, input.right, input.firstPlayerId), input.maxActions,
      { seed: input.seed, levels: { 'player-one': input.aiLevel, 'player-two': input.aiLevel },
        ...(input.deterministicSearch ? { searchNow: () => 0 } : {}),
        experienceProfile: input.experienceProfile, experienceProfileByPlayer: input.experienceProfileByPlayer },
    )
    parentPort.postMessage({ id, outcome: { result, error: null } })
  } catch (error) {
    parentPort.postMessage({ id, outcome: { result: null, error: error instanceof Error ? error.message : String(error) } })
  }
})
