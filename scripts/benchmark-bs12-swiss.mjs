import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tsImport } from 'tsx/esm/api'

const game = await tsImport('../src/game/index.ts', import.meta.url)
const { Bs11SimulationPool } = await tsImport('./lib/bs11-simulation-pool.ts', import.meta.url)
const { runTop8 } = await tsImport('./lib/bs11-playoffs.ts', import.meta.url)
const colors = ['blue', 'green', 'yellow', 'red', 'purple', 'black']
const names = { blue: '藍', green: '綠', yellow: '黃', red: '紅', purple: '紫', black: '黑' }
const seed = 20261009
const maxActions = game.MAX_TOURNAMENT_ACTIONS
const smoke = process.argv.includes('--smoke')
const holdout = process.argv.includes('--holdout')
const directory = `output/bs12-1028${smoke ? '-smoke' : ''}`
await mkdir(directory, { recursive: true })
const hash = value => createHash('sha256').update(value).digest('hex')
const json = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
const recipes = Object.fromEntries(await Promise.all(colors.map(async color => {
  const path = `data/decks/bs12-${color}-arena.json`
  const source = await readFile(path, 'utf8')
  return [color, { path, sha256: hash(source), recipe: JSON.parse(source) }]
})))
const defaultProfile = holdout
  ? JSON.parse(await readFile(`${directory}/baseline-experience.json`, 'utf8'))
  : game.DEFAULT_LV5_TOURNAMENT_EXPERIENCE_PROFILE
const rosterSize = smoke ? 24 : 1028
const rounds = smoke ? 2 : 11
const decks = Array.from({ length: rosterSize }, (_, index) => {
  const color = colors[index % colors.length]
  const { recipe } = recipes[color]
  return { ...structuredClone(recipe), id: `bs12-${String(index + 1).padStart(4, '0')}`,
    name: `#${String(index + 1).padStart(4, '0')} ${names[color]}色`, color,
    seedChoice: `bs12-${color}-arena`, format: 'standard',
    createdAt: '2026-10-09T00:00:00+08:00', updatedAt: '2026-10-09T00:00:00+08:00' }
})
for (const deck of decks) assert.deepEqual(game.validateCustomDeckDefinition(deck).errors, [], deck.id)
const byId = new Map(decks.map(deck => [deck.id, deck]))
const distribution = ids => colors.map(color => ({ color, name: names[color],
  count: ids.filter(id => byId.get(id)?.color === color).length,
  percentage: ids.length ? ids.filter(id => byId.get(id)?.color === color).length / ids.length * 100 : 0 }))

const successful = outcome => Boolean(outcome.result?.endInfo.winner && !outcome.error &&
  !outcome.result.error && !outcome.result.stuck && !outcome.result.turnProgression.turnCapReached &&
  outcome.result.behavior.invalidActionCount === 0 && outcome.result.behavior.deadlockCount === 0)
const playerMetrics = (result, playerId) => {
  const b = result.behavior.byPlayer[playerId]
  return { skills: b.skillUsageCount, invalid: b.invalidActionCount, deadlock: b.deadlockCount,
    legalAttackSkipped: b.legalAttackSkippedCount, lethalOpportunities: b.lethalOpportunityCount,
    lethalConversions: b.lethalConversionCount, resourceReservationMisses: b.lv4Search.resourceReservationMisses,
    totalDecisions: result.decisionProfileByPlayer[playerId].totalDecisions }
}

if (holdout) {
  assert.equal(smoke, false)
  const report = JSON.parse(await readFile('data/decks/bs12-1028-report.json', 'utf8'))
  assert.equal(report.status, 'PASS', 'Training acceptance requires a completed baseline tournament')
  assert.equal(hash(JSON.stringify(defaultProfile)), report.methodology.baselineProfileSha256)
  for (const color of colors) assert.equal(recipes[color].sha256, report.methodology.recipes[color].sha256,
    'Holdout must use the frozen tournament recipes')
  const trained = JSON.parse(await readFile(`${directory}/experience-candidate.json`, 'utf8'))
  const pool = new Bs11SimulationPool(4)
  const inputs = []
  const metadata = []
  // Every color matchup, including mirrors: 21 pairs × 4 new seeds × 4
  // seat/first-player assignments. Candidate selection never reads holdout.
  for (let left = 0; left < colors.length; left++) for (let right = left; right < colors.length; right++) {
    for (let repeat = 0; repeat < 4; repeat++) for (const trainedPlayerId of ['player-one', 'player-two']) {
      for (const firstPlayerId of ['player-one', 'player-two']) {
        const matchSeed = seed + 100_000_000 + left * 100_000 + right * 1_000 + repeat
        inputs.push({ seed: matchSeed, left: decks[left], right: decks[right], firstPlayerId,
          aiLevel: 5, maxActions, deterministicSearch: true,
          experienceProfileByPlayer: { 'player-one': trainedPlayerId === 'player-one' ? trained : defaultProfile,
            'player-two': trainedPlayerId === 'player-two' ? trained : defaultProfile } })
        metadata.push({ leftColor: colors[left], rightColor: colors[right], trainedPlayerId, firstPlayerId, seed: matchSeed })
      }
    }
  }
  const rows = []
  try {
    for (let start = 0; start < inputs.length; start += 24) {
      const outcomes = await pool.simulateRound(inputs.slice(start, start + 24))
      for (const [offset, outcome] of outcomes.entries()) {
        const m = metadata[start + offset]
        const result = outcome.result
        rows.push({ ...m, status: successful(outcome) ? 'PASS' : 'FAIL', error: outcome.error ?? result?.error,
          winner: result?.endInfo.winner, actions: result?.actions,
          trainedWon: successful(outcome) ? result.endInfo.winner === m.trainedPlayerId : null,
          trainedMetrics: result ? playerMetrics(result, m.trainedPlayerId) : null,
          baselineMetrics: result ? playerMetrics(result, m.trainedPlayerId === 'player-one' ? 'player-two' : 'player-one') : null })
      }
      await json(`${directory}/holdout-progress.json`, { completed: rows.length, total: inputs.length })
      console.log(`Holdout ${rows.length}/${inputs.length}`)
    }
  } finally { await pool.close() }
  const completed = rows.filter(row => row.status === 'PASS')
  const wins = completed.filter(row => row.trainedWon).length
  const n = completed.length
  const p = n ? wins / n : 0
  const z = 1.96
  const center = (p + z * z / (2 * n)) / (1 + z * z / n)
  const half = z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n) / (1 + z * z / n)
  const summary = { status: n === rows.length ? 'PASS' : 'FAIL', matches: rows.length, completed: n,
    trainedWins: wins, baselineWins: n - wins, winRate: p,
    wilson95: [center - half, center + half],
    adoptionEligible: false,
    adoptionPolicy: 'All games complete, candidate overall win rate at least 55%, and no color loses win rate against the same-color baseline sample. Fixed before holdout.',
    inference: 'Correlated matched seeds; descriptive Wilson interval is not a paired significance test.',
    candidateSha256: hash(JSON.stringify(trained)), baselineSha256: hash(JSON.stringify(defaultProfile)),
    byColor: colors.map(color => {
      const subset = completed.filter(row => (row.trainedPlayerId === 'player-one' ? row.leftColor : row.rightColor) === color)
      const baselineSubset = completed.filter(row => (row.trainedPlayerId === 'player-one' ? row.rightColor : row.leftColor) === color)
      return { color, games: subset.length, wins: subset.filter(row => row.trainedWon).length,
        baselineGames: baselineSubset.length, baselineWins: baselineSubset.filter(row => !row.trainedWon).length,
        trainedMetrics: subset.map(row => row.trainedMetrics), baselineMetrics: baselineSubset.map(row => row.baselineMetrics) }
    }), rows }
  summary.adoptionEligible = n === rows.length && p >= 0.55 && summary.byColor.every(color =>
    color.wins / color.games >= color.baselineWins / color.baselineGames)
  await json(`${directory}/holdout.json`, summary)
  console.log(JSON.stringify({ ...summary, rows: undefined, byColor: undefined }))
  process.exitCode = summary.status === 'PASS' ? 0 : 1
} else {
  await json(`${directory}/baseline-experience.json`, defaultProfile)
  const roster = { seed, recipes, decks }
  const rosterPath = smoke ? `${directory}/roster.json` : 'data/decks/bs12-1028-roster.json'
  await json(rosterPath, roster)
  const accumulator = game.createAiTournamentExperienceAccumulator()
  const perColor = Object.fromEntries(colors.map(color => [color, { games: 0, wins: 0, nonMirrorGames: 0,
    nonMirrorWins: 0, firstGames: 0, firstWins: 0, skills: 0, decisions: 0,
    invalid: 0, deadlock: 0, resourceReservationMisses: 0, legalAttackSkipped: 0,
    lethalOpportunities: 0, lethalConversions: 0, damage: 0, attacks: 0, kills: 0, byCardAction: {} }]))
  const telemetry = []
  const failures = []
  const pool = new Bs11SimulationPool(4)
  const startedAt = new Date().toISOString()
  const matchLog = `${directory}/matches-${Date.now()}.jsonl`
  let played = 0
  const swiss = await game.runSwissTournament(decks, {
    rounds, seed, maxActions, aiLevel: 5, experienceProfile: defaultProfile,
    deterministicSearch: true, avoidRematches: true, progressEvery: 128,
    simulateRound: inputs => pool.simulateRound(inputs),
    onMatch: async ({ record, result }) => {
      played++
      await appendFile(matchLog, `${JSON.stringify(record)}\n`)
      if (record.result !== 'win' || !result || result.behavior.invalidActionCount || result.behavior.deadlockCount) failures.push(record)
      if (record.result === 'win' && result && !result.error && !result.behavior.invalidActionCount && !result.behavior.deadlockCount) {
        game.recordAiTournamentMatchExperience(accumulator, result.decisionProfileByPlayer, result.endInfo.winner)
      }
      if (result) {
        const row = { round: record.round, table: record.table, comboStarted: result.behavior.comboIntentsStarted,
          comboCompleted: result.behavior.comboIntentsCompleted, comboAbandoned: result.behavior.comboIntentsAbandoned,
          players: {} }
        for (const [playerId, deckId, otherId] of [
          ['player-one', record.playerOneDeckId, record.playerTwoDeckId],
          ['player-two', record.playerTwoDeckId, record.playerOneDeckId],
        ]) {
          const color = byId.get(deckId).color
          const c = perColor[color]
          const won = record.result === 'win' && record.winnerDeckId === deckId
          const m = playerMetrics(result, playerId)
          c.games++; c.wins += Number(won)
          if (color !== byId.get(otherId).color) { c.nonMirrorGames++; c.nonMirrorWins += Number(won) }
          if (record.firstPlayerId === playerId) { c.firstGames++; c.firstWins += Number(won) }
          c.skills += m.skills; c.decisions += m.totalDecisions; c.invalid += m.invalid; c.deadlock += m.deadlock
          c.resourceReservationMisses += m.resourceReservationMisses; c.legalAttackSkipped += m.legalAttackSkipped
          c.lethalOpportunities += m.lethalOpportunities; c.lethalConversions += m.lethalConversions
          const attacks = result.attackEvents.filter(event => event.attackerPlayerId === playerId)
          c.attacks += attacks.length; c.damage += attacks.reduce((sum, event) => sum + event.damage, 0)
          c.kills += attacks.filter(event => event.isKill).length
          for (const [card, actions] of Object.entries(result.decisionProfileByPlayer[playerId].byCardAction)) {
            c.byCardAction[card] ??= {}
            for (const [action, count] of Object.entries(actions)) c.byCardAction[card][action] = (c.byCardAction[card][action] ?? 0) + count
          }
          row.players[playerId] = { color, ...m }
        }
        telemetry.push(row)
      }
      if (played % 128 === 0) await json(`${directory}/progress.json`, { played, total: rosterSize / 2 * rounds, failures: failures.length })
    },
    onProgress: progress => console.log(`Swiss ${progress.round}/${rounds}: ${progress.completedMatches}/${progress.totalMatches}; failures=${failures.length}`),
  }).finally(() => pool.close())
  assert.equal(swiss.matches.length, rosterSize / 2 * rounds)
  const top16 = swiss.standings.slice(0, 16)
  const round16 = []
  const advanced = []
  const play = (stage, table, leftId, rightId) => {
    const matchSeed = seed + 20_000_000 + (stage === 'round16' ? 0 : stage === 'quarterfinal' ? 1 : stage === 'semifinal' ? 2 : 3) * 100 + table
    const firstPlayerId = table % 2 === 0 ? 'player-one' : 'player-two'
    const result = game.simulateAiMatchDetailed(game.createCustomDeckMatch(matchSeed, byId.get(leftId), byId.get(rightId), firstPlayerId), maxActions,
      { seed: matchSeed, levels: { 'player-one': 5, 'player-two': 5 }, experienceProfile: defaultProfile, searchNow: () => 0 })
    const ok = successful({ result, error: null })
    const winnerId = ok ? result.endInfo.winner === 'player-one' ? leftId : rightId : null
    console.log(`${stage} ${table}: ${leftId} vs ${rightId} -> ${winnerId ?? 'UNRESOLVED'}`)
    return { stage, table, leftId, rightId, seed: matchSeed, firstPlayerId, winnerId,
      actions: result.actions, turns: result.state.turnNumber - 1, error: ok ? null : result.error ?? 'unresolved' }
  }
  for (let index = 0; index < 8; index++) {
    const match = play('round16', index + 1, top16[index].deckId, top16[15 - index].deckId)
    round16.push(match)
    if (match.winnerId) advanced.push(top16.find(row => row.deckId === match.winnerId))
  }
  const playoff = advanced.length === 8 ? runTop8(advanced.sort((a, b) => a.rank - b.rank), play)
    : { status: 'FAIL', champion: null, runnerUp: null, top8: advanced, top4: [], matches: [] }
  const report = { status: swiss.status === 'PASS' && playoff.status === 'PASS' && failures.length === 0 ? 'PASS' : 'FAIL',
    startedAt, generatedAt: new Date().toISOString(),
    methodology: { rosterSize, rounds, swissMatches: rosterSize / 2 * rounds, playoffMatches: 15,
      seed, maxActions, aiLevel: 5, strategyVersion: game.AI_STRATEGY_VERSION,
      baselineProfile: defaultProfile.id, baselineProfileSha256: hash(JSON.stringify(defaultProfile)), matchLog,
      recipes, rosterSha256: hash(JSON.stringify(roster)),
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
      population: 'Repeated entrants of the exact six current recipes; balanced assigned field, not external metagame share.',
      bracket: '1v16 to 8v9; reseed advancing eight by Swiss rank, then fixed 1v8/4v5/2v7/3v6 bracket.',
      runtime: 'Four isolated Node workers, deterministic node budget; no Browser/online acceptance claim.',
      invalidPolicy: 'No favorable seed reruns; unresolved Swiss keeps existing one point each and FAIL; unresolved playoff has no winner.' },
    swiss, round16, playoff, perColor, failures,
    distributions: { entrants: distribution(decks.map(deck => deck.id)),
      top16: distribution(top16.map(row => row.deckId)), top8: distribution(playoff.top8.map(row => row.deckId)),
      top4: distribution(playoff.top4.map(row => row.deckId)) }, top16 }
  const profile = game.finalizeAiTournamentExperience(accumulator, { id: 'bs12-1028-20261009',
    strategyVersion: game.AI_STRATEGY_VERSION, series: 'BS12',
    source: { tournamentId: 'bs12-1028-20261009', rosterSize, rounds,
      swissMatches: accumulator.decisiveMatches, seed, generatedAt: report.generatedAt } })
  await json(`${directory}/experience-candidate.json`, profile)
  await json(`${directory}/telemetry.json`, telemetry)
  await json(smoke ? `${directory}/report.json` : 'data/decks/bs12-1028-report.json', report)
  console.log(JSON.stringify({ status: report.status, swiss: swiss.metrics, champion: playoff.champion?.name,
    round16: round16.length, playoffs: playoff.matches.length, trainedFrom: accumulator.decisiveMatches }))
  process.exitCode = report.status === 'PASS' ? 0 : 1
}
