import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const file = resolve('data/decks/bs11-1024-report.json')
const source = await readFile(file, 'utf8')
const report = JSON.parse(source)
const roster = JSON.parse(await readFile('data/decks/bs11-1024-roster.json', 'utf8'))
const matches = report.swiss.matches
assert.equal(report.status, 'PASS')
assert.equal(roster.decks.length, 1024)
assert.equal(matches.length, 5120)
assert.equal(report.swiss.metrics.stuckMatches, 0)
assert.equal(report.methodology.rosterHash, createHash('sha256').update(await readFile('data/decks/bs11-1024-roster.json')).digest('hex'))
const rows = new Map(report.swiss.standings.map((row) => [row.deckId, row]))
assert.equal(rows.size, 1024)
const history = new Map(roster.decks.map((deck) => [deck.id, { wins: 0, losses: 0, opponents: new Set(), appearances: 0 }]))
const pairKeys = new Set()
for (let round = 1; round <= 10; round++) {
  const games = matches.filter((row) => row.round === round)
  assert.equal(games.length, 512)
  assert.equal(new Set(games.map((row) => row.table)).size, 512)
  const entrants = new Set()
  for (const game of games) {
    assert.equal(game.result, 'win')
    assert.equal(game.error, null)
    assert.ok(game.actions > 0 && game.actions <= 500)
    const ids = [game.playerOneDeckId, game.playerTwoDeckId]
    assert.ok(ids.includes(game.winnerDeckId) && ids.includes(game.loserDeckId))
    assert.notEqual(game.winnerDeckId, game.loserDeckId)
    const key = [...ids].sort().join('|')
    assert.equal(pairKeys.has(key), false, `Swiss rematch ${key}`)
    pairKeys.add(key)
    for (const [index, id] of ids.entries()) {
      assert.equal(entrants.has(id), false, `Duplicate entrant in round ${round}`)
      entrants.add(id)
      const entry = history.get(id)
      assert.ok(entry, 'Unknown entrant')
      entry.appearances++
      entry.opponents.add(ids[1 - index])
      if (game.winnerDeckId === id) entry.wins++
      else entry.losses++
    }
  }
  assert.equal(entrants.size, 1024)
}
for (const [id, actual] of history) {
  const row = rows.get(id)
  assert.ok(row)
  assert.equal(actual.appearances, 10)
  assert.equal(row.games, 10)
  assert.equal(row.wins, actual.wins)
  assert.equal(row.losses, actual.losses)
  assert.equal(row.draws, 0)
  assert.equal(row.points, actual.wins * 3)
  assert.equal(row.buchholz, [...actual.opponents].reduce((sum, opponent) => sum + rows.get(opponent).points, 0))
}
assert.equal(report.playoff.matches.length, 7)
assert.equal(report.playoff.top8.length, 8)
assert.equal(report.playoff.top4.length, 4)
assert.equal(report.playoff.finalists.length, 2)
for (const game of report.playoff.matches) {
  assert.equal(game.error, null)
  assert.ok([game.leftId, game.rightId].includes(game.winnerId))
  assert.ok(game.actions > 0 && game.actions <= 500)
}
assert.equal(report.playoff.matches.at(-1).winnerId, report.playoff.champion.deckId)
assert.deepEqual(report.playoff.top8.map((row) => row.deckId), report.swiss.standings.slice(0, 8).map((row) => row.deckId))
const cut = report.playoff.top8.map((row) => row.deckId)
const quarterfinals = report.playoff.matches.filter((game) => game.stage === 'quarterfinal')
const semifinals = report.playoff.matches.filter((game) => game.stage === 'semifinal')
const finals = report.playoff.matches.filter((game) => game.stage === 'final')
assert.equal(quarterfinals.length, 4)
assert.equal(semifinals.length, 2)
assert.equal(finals.length, 1)
assert.deepEqual(quarterfinals.map((game) => [game.leftId, game.rightId]), [[cut[0], cut[7]], [cut[3], cut[4]], [cut[1], cut[6]], [cut[2], cut[5]]])
const four = quarterfinals.map((game) => game.winnerId)
assert.deepEqual(report.playoff.top4.map((row) => row.deckId), four)
assert.deepEqual(semifinals.map((game) => [game.leftId, game.rightId]), [[four[0], four[1]], [four[2], four[3]]])
const two = semifinals.map((game) => game.winnerId)
assert.deepEqual(report.playoff.finalists.map((row) => row.deckId), two)
assert.deepEqual([finals[0].leftId, finals[0].rightId], two)
assert.equal(report.playoff.runnerUp.deckId, two.find((id) => id !== finals[0].winnerId))
for (const [key, expected] of [['entrants', roster.decks], ['top8', report.playoff.top8], ['top4', report.playoff.top4]]) {
  const total = expected.length
  assert.equal(report.distributions[key].reduce((sum, row) => sum + row.count, 0), total)
  for (const row of report.distributions[key]) {
    assert.equal(row.count, expected.filter((deck) => deck.color === row.color).length)
    assert.ok(Math.abs(row.percentage - row.count / total * 100) < 1e-8)
  }
}
const proof = { status: 'PASS', file, sourceSha256: createHash('sha256').update(source).digest('hex'), matches: 5120, playoffs: 7, entrants: 1024,
  rematches: 0, unresolved: 0, checks: ['per-round appearances', 'winner identity', '500-action cap', 'points', 'Buchholz', 'top-cut bracket', 'color proportions', 'roster hash'] }
await mkdir('output/bs11-1024', { recursive: true })
await writeFile('output/bs11-1024/result-audit.json', JSON.stringify(proof, null, 2))
console.log(JSON.stringify(proof, null, 2))
