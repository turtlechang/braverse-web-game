import type { SwissStanding } from '../../src/game/tournament'

export type PlayoffStage = 'quarterfinal' | 'semifinal' | 'final'
export interface PlayoffGame {
  stage: PlayoffStage
  table: number
  leftId: string
  rightId: string
  winnerId: string | null
  seed: number
  firstPlayerId: 'player-one' | 'player-two'
  actions: number
  turns: number
  error: string | null
}

export const runTop8 = (standings: SwissStanding[], play: (stage: PlayoffStage, table: number, leftId: string, rightId: string) => PlayoffGame) => {
  const top8 = standings.slice(0, 8)
  if (top8.length !== 8) throw new Error('Top cut requires eight standings')
  const matches: PlayoffGame[] = []
  const top4: SwissStanding[] = []
  const finalists: SwissStanding[] = []
  const standing = (id: string) => {
    const entry = top8.find((row) => row.deckId === id)
    if (!entry) throw new Error(`Playoff winner is outside top cut: ${id}`)
    return entry
  }
  const result = (champion: SwissStanding | null, runnerUp: SwissStanding | null) => ({
    status: champion ? 'PASS' : 'FAIL', top8, top4, finalists, champion, runnerUp, matches,
  })
  const advance = (stage: PlayoffStage, table: number, leftId: string, rightId: string) => {
    const game = play(stage, table, leftId, rightId)
    matches.push(game)
    if (game.winnerId !== null && game.winnerId !== leftId && game.winnerId !== rightId) throw new Error('Winner must belong to this match')
    if (game.error) return null
    return game.winnerId
  }
  // Fixed bracket: winner of 1v8 meets winner of 4v5; 2v7 meets 3v6.
  for (const [table, [left, right]] of [[0, 7], [3, 4], [1, 6], [2, 5]].entries()) {
    const id = advance('quarterfinal', table + 1, top8[left].deckId, top8[right].deckId)
    if (!id) return result(null, null)
    top4.push(standing(id))
  }
  for (const table of [0, 1]) {
    const id = advance('semifinal', table + 1, top4[table * 2].deckId, top4[table * 2 + 1].deckId)
    if (!id) return result(null, null)
    finalists.push(standing(id))
  }
  const id = advance('final', 1, finalists[0].deckId, finalists[1].deckId)
  if (!id) return result(null, null)
  return result(standing(id), finalists.find((entry) => entry.deckId !== id)!)
}
