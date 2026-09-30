import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createCustomDeckMatch, simulateAiMatchDetailed, type SwissRosterDeck, type SwissMatchRecord } from '../src/game'
import { handleAiPendingBattle } from '../src/game/ai/battle-handler'

const roster = JSON.parse(await readFile('data/decks/bs11-1024-roster.json', 'utf8')) as { decks: SwissRosterDeck[] }
const files = (await readdir('test-results/bs11-1024/full')).filter((file) => file.startsWith('matches-') && file.endsWith('.jsonl')).sort()
const source = process.argv.find((arg) => arg.startsWith('--source='))?.slice(9) ?? `test-results/bs11-1024/full/${files.at(-1)}`
const failures = (await readFile(source, 'utf8')).trim().split('\n').map((line) => JSON.parse(line) as SwissMatchRecord).filter((row) => row.result === 'stuck')
const byId = new Map(roster.decks.map((deck) => [deck.id, deck]))
const results = []
for (const match of failures.slice(0, 6)) {
  const seed = 20260930 + match.round * 1_000_000 + match.table - 1
  const result = simulateAiMatchDetailed(createCustomDeckMatch(seed, byId.get(match.playerOneDeckId)!, byId.get(match.playerTwoDeckId)!, match.firstPlayerId),
    500, { levels: { 'player-one': 5, 'player-two': 5 }, seed, experienceProfile: null,
      ...(process.argv.includes('--deterministic-search') ? { searchNow: () => 0 } : {}) })
  const state = result.state
  if (state.pendingBattle?.stage === 'trap') {
    try { handleAiPendingBattle(state, state.pendingBattle.defenderPlayerId, 5) }
    catch (error) { console.log(error instanceof Error ? error.stack : error) }
  }
  const diagnostic = { match, seed, stuck: result.stuck, error: result.error, actions: result.actions, winner: result.endInfo.winner,
    players: Object.fromEntries(Object.entries(state.players).map(([id, player]) => [id, { trash: player.discardPile.length,
      supports: player.supportArea.map((entry) => ({id: entry.card.id, rested: entry.rested})),
      hand: player.hand.map((card) => ({id:card.id, name:card.name, ability:card.type !== 'cookie' ? card : undefined})) }])),
    pending: { ability: state.pendingAbilityEffect,
      battle: state.pendingBattle ? { stage: state.pendingBattle.stage, attacker: state.pendingBattle.attackerPlayerId, effects: state.pendingBattle.attackEffects, index: state.pendingBattle.attackEffectIndex, sequence: state.pendingBattle.effectDamageSequence } : null },
    lastLogs: result.logs.slice(-12) }
  results.push(diagnostic)
  console.log(JSON.stringify(diagnostic, null, 2))
}
await writeFile('test-results/bs11-1024/reproduced-failures.json', JSON.stringify(results, null, 2))
process.exitCode = results.some((row) => row.stuck || !row.winner) ? 1 : 0
