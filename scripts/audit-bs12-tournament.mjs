import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const reportPath = 'data/decks/bs12-1028-report.json'
const source = await readFile(reportPath, 'utf8')
const report = JSON.parse(source)
const roster = JSON.parse(await readFile('data/decks/bs12-1028-roster.json', 'utf8'))
assert.equal(report.status, 'PASS')
assert.equal(roster.decks.length, 1028)
assert.equal(report.swiss.matches.length, 5654)
assert.equal(report.failures.length, 0)
const pairs = new Set()
for (const match of report.swiss.matches) {
  assert.equal(match.result, 'win')
  assert.equal(match.error, null)
  assert.ok([match.playerOneDeckId, match.playerTwoDeckId].includes(match.winnerDeckId))
  const key = [match.playerOneDeckId, match.playerTwoDeckId].sort().join(':')
  assert.ok(!pairs.has(key), `Repeated opponents: ${key}`)
  pairs.add(key)
}
for (let round = 1; round <= 11; round++) {
  const matches = report.swiss.matches.filter(match => match.round === round)
  assert.equal(matches.length, 514)
  assert.equal(new Set(matches.flatMap(match => [match.playerOneDeckId, match.playerTwoDeckId])).size, 1028)
}
assert.equal(report.swiss.standings.length, 1028)
for (const standing of report.swiss.standings) {
  assert.equal(standing.wins + standing.losses + standing.draws, 11)
  assert.equal(standing.points, standing.wins * 3 + standing.draws)
}
assert.equal(report.round16.length + report.playoff.matches.length, 15)
for (const match of [...report.round16, ...report.playoff.matches]) {
  assert.equal(match.error, null)
  assert.ok([match.leftId, match.rightId].includes(match.winnerId))
}
assert.deepEqual(new Set(report.playoff.top8.map(row => row.deckId)), new Set(report.round16.map(row => row.winnerId)))
assert.deepEqual(new Set(report.playoff.top4.map(row => row.deckId)), new Set(report.playoff.matches.filter(row => row.stage === 'quarterfinal').map(row => row.winnerId)))
const final = report.playoff.matches.find(row => row.stage === 'final')
assert.equal(report.playoff.champion.deckId, final.winnerId)
const candidate = JSON.parse(await readFile('output/bs12-1028/experience-candidate.json', 'utf8'))
assert.equal(candidate.source.swissMatches, 5654)
for (const weight of [...Object.values(candidate.actionWeights), ...Object.values(candidate.cardActionWeights).flatMap(Object.values)]) assert.ok(Math.abs(weight) <= 24)
const evidence = { status: 'PASS', reportPath, sha256: createHash('sha256').update(source).digest('hex'),
  entrants: 1028, rounds: 11, swissMatches: 5654, uniquePairings: pairs.size, playoffMatches: 15,
  checks: ['every entrant once per round', 'no rematches', 'standings arithmetic', 'actual bracket winners', 'training source and bounded priors'] }
await writeFile('output/bs12-1028/result-audit.json', JSON.stringify(evidence, null, 2))
console.log(JSON.stringify(evidence))
