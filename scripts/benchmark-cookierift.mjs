import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { build } from 'esbuild'

const outputDirectory = path.resolve('output/ai-cookierift')
const communitySnapshotPaths = [
  'data/decks/cookierift-community-20261016-silent.json',
  'data/decks/cookierift-community-20261016.json',
  'data/decks/cookierift-community-20261015.json',
  'data/decks/cookierift-community-20261014.json',
  'data/decks/cookierift-community-20261013.json',
  'data/decks/cookierift-community-20261010.json',
]
const acceptedCommunityIds = [921, 927, 801, 67, 83, 568, 506, 1035, 793, 973, 16, 731, 1164, 1239, 1151, 1259, 1207]
const bs12Colors = ['blue', 'green', 'yellow', 'red', 'purple', 'black']
const hash = value => createHash('sha256').update(value).digest('hex')
const auditCandidateInputs = async (metafile, baselineManifest) => {
  if (!baselineManifest) return null
  const normalizePath = value => value.replaceAll('\\', '/')
  const baselineInputs = baselineManifest.inputs
    .map(input => ({ ...input, path: normalizePath(input.path) }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  const candidatePaths = Object.keys(metafile.inputs)
    .map(normalizePath)
    .sort()
  assert.deepStrictEqual(candidatePaths, baselineInputs.map(input => input.path),
    'Candidate source path set differs from the baseline manifest')

  const candidateInputs = await Promise.all(baselineInputs.map(async input => ({
    path: input.path,
    policy: input.policy,
    sha256: hash(await readFile(path.resolve(input.path))),
  })))
  const candidateRuleAndDataInputs = candidateInputs.filter(input => !input.policy)
  assert.deepStrictEqual(candidateRuleAndDataInputs, baselineInputs.filter(input => !input.policy),
    'Candidate current-rule/data inputs differ from the baseline')
  assert.equal(hash(JSON.stringify(candidateRuleAndDataInputs)), baselineManifest.currentRuleAndDataInputsSha256,
    'Candidate current-rule/data input manifest hash differs from the baseline')
  const candidatePolicyInputs = candidateInputs.filter(input => input.policy)
  return {
    inputCount: candidateInputs.length,
    policyInputCount: candidatePolicyInputs.length,
    currentRuleAndDataInputCount: candidateRuleAndDataInputs.length,
    inputPathsSha256: hash(JSON.stringify(candidatePaths)),
    policyInputsSha256: hash(JSON.stringify(candidatePolicyInputs)),
    currentRuleAndDataInputsSha256: hash(JSON.stringify(candidateRuleAndDataInputs)),
  }
}
const HELP = `Usage: node scripts/benchmark-cookierift.mjs [options]

Options:
  --baseline <path>    AI policy baseline ESM bundle (default: output/ai-cookierift/baseline-policy-current-rules.mjs)
  --candidate <path>   Candidate ESM bundle output (defaults to a unique filename)
  --report <path>      JSON report output (defaults to a unique filename)
  --seed-base <number> Matched benchmark seed base
  --level <1-5>        AI level to evaluate (default: 5)
  --plan-only          Validate recipes/paths and print the matched-game plan without building or playing
  --help               Show this help

Environment aliases: BRAVERSE_BENCHMARK_BASELINE_PATH, BRAVERSE_BENCHMARK_CANDIDATE_PATH,
BRAVERSE_BENCHMARK_REPORT_PATH, BRAVERSE_BENCHMARK_SEED_BASE, and BRAVERSE_BENCHMARK_LEVEL. The legacy
BRAVERSE_BENCHMARK_REPORT accepts a report filename under output/ai-cookierift.
Existing baseline, candidate, and report paths are never overwritten.`

if (!isMainThread) {
  const baseline = await import(pathToFileURL(workerData.baselinePath).href)
  const candidate = await import(pathToFileURL(workerData.candidatePath).href)
  parentPort.on('message', job => {
    let state = null
    let error = null
    let failureType = null
    let failureStage = 'baseline-setup'
    let actions = 0
    let initialStateParity = false
    try {
      const baselineInitialState = baseline.createCustomDeckMatch(
        job.seed, job.left, job.right, job.firstPlayerId,
      )
      failureStage = 'candidate-setup'
      const candidateInitialState = candidate.createCustomDeckMatch(
        job.seed, job.left, job.right, job.firstPlayerId,
      )
      failureStage = 'initial-state-parity'
      assert.deepStrictEqual(baselineInitialState, candidateInitialState,
        'Baseline and candidate produced different initial states for the same seed and decks')
      initialStateParity = true
      state = candidateInitialState
      const memories = {}
      failureStage = 'decision'
      for (; actions < 500 && state.status !== 'finished'; actions++) {
        const player = baseline.getActingPlayerId(state)
        const engine = player === job.candidatePlayerId ? candidate : baseline
        const decision = engine.takeAiStep(state, player, {
          level: workerData.level, seed: job.seed, searchNow: () => 0, memory: memories[player],
        })
        if (decision.reason?.strategyMemory) memories[player] = decision.reason.strategyMemory
        if (decision.action === 'error' || decision.state === state) {
          throw new Error(decision.error ?? `No progress: ${decision.description}`)
        }
        state = decision.state
      }
      if (state.status !== 'finished') {
        failureType = actions >= 500 ? 'action-cap-500' : 'unfinished'
        throw new Error(actions >= 500 ? '500 action cap reached' : `Unfinished match: ${state.status}`)
      }
      if (!state.result?.winnerId) {
        failureType = 'missing-winner'
        throw new Error('Finished match has no winner')
      }
    } catch (cause) {
      error = String(cause)
      failureType ??= failureStage === 'baseline-setup'
        ? (error.includes('不在可用卡池中') ? 'baseline-incompatible' : 'baseline-setup-error')
        : failureStage === 'candidate-setup'
          ? 'candidate-setup-error'
          : failureStage === 'initial-state-parity'
            ? 'initial-state-mismatch'
            : error.includes('500 action cap reached') ? 'action-cap-500' : 'decision-error'
    }
    parentPort.postMessage({
      seed: job.seed,
      left: job.left.color,
      right: job.right.color,
      leftRecipe: job.left.id,
      rightRecipe: job.right.id,
      firstPlayerId: job.firstPlayerId,
      candidatePlayerId: job.candidatePlayerId,
      candidateColor: job.candidatePlayerId === 'player-one' ? job.left.color : job.right.color,
      stateStatus: state?.status ?? null,
      winner: state?.result?.winnerId ?? null,
      actions,
      initialStateParity,
      error,
      failureType,
      failureStage: error ? failureStage : null,
      candidateWon: !error ? state.result.winnerId === job.candidatePlayerId : null,
    })
  })
} else {
  const args = parseArguments(process.argv.slice(2))
  if (args.help) {
    console.log(HELP)
  } else {
    const seedBase = Number(args.seedBase ?? process.env.BRAVERSE_BENCHMARK_SEED_BASE ?? 202610110)
    if (!Number.isSafeInteger(seedBase) || seedBase < 0) {
      throw new Error('Seed base must be a non-negative safe integer')
    }
    const level = Number(args.level ?? process.env.BRAVERSE_BENCHMARK_LEVEL ?? 5)
    if (!Number.isSafeInteger(level) || level < 1 || level > 5) {
      throw new Error('AI level must be an integer from 1 through 5')
    }

    const runId = `${new Date().toISOString().replace(/[-:.]/g, '')}-${process.pid}-${randomUUID().slice(0, 8)}`
    const baselinePath = resolveConfiguredPath(
      args.baseline ?? process.env.BRAVERSE_BENCHMARK_BASELINE_PATH ?? path.join(outputDirectory, 'baseline-policy-current-rules.mjs'),
    )
    const candidatePath = resolveConfiguredPath(
      args.candidate ?? process.env.BRAVERSE_BENCHMARK_CANDIDATE_PATH ?? path.join(outputDirectory, `candidate-engine-${runId}.mjs`),
    )
    const legacyReport = process.env.BRAVERSE_BENCHMARK_REPORT
    const reportSetting = args.report ?? process.env.BRAVERSE_BENCHMARK_REPORT_PATH ??
      (legacyReport ? (path.isAbsolute(legacyReport) ? legacyReport : path.join(outputDirectory, legacyReport)) :
        path.join(outputDirectory, `matched-comparison-${runId}.json`))
    const reportPath = resolveConfiguredPath(reportSetting)
    assertDistinctPaths({ baselinePath, candidatePath, reportPath })
    if (path.extname(baselinePath).toLowerCase() !== '.mjs' || path.extname(candidatePath).toLowerCase() !== '.mjs') {
      throw new Error('Baseline and candidate bundle paths must end in .mjs')
    }
    if (path.extname(reportPath).toLowerCase() !== '.json') throw new Error('Report path must end in .json')

    await assertExists(baselinePath, 'Baseline bundle')
    await assertDoesNotExist(candidatePath, 'Candidate bundle')
    await assertDoesNotExist(reportPath, 'Report')
    const baselineBytes = await readFile(baselinePath)
    const baselineSha256 = hash(baselineBytes)
    let baselineManifest = null
    if (path.basename(baselinePath).startsWith('baseline-policy-current-rules')) {
      const manifestPath = baselinePath.replace(/\.mjs$/i, '-manifest.json')
      await assertExists(manifestPath, 'Baseline manifest')
      baselineManifest = JSON.parse((await readFile(manifestPath)).toString('utf8'))
      assert.equal(baselineManifest.engineSha256, baselineSha256,
        'Baseline bundle does not match its manifest; rebuild the current-rules baseline')
      const currentInputs = baselineManifest.inputs.filter(input => !input.policy)
      assert.equal(hash(JSON.stringify(currentInputs)), baselineManifest.currentRuleAndDataInputsSha256,
        'Baseline current-rule input manifest hash is invalid')
      for (const input of currentInputs) {
        const currentSha256 = hash(await readFile(path.resolve(input.path)))
        assert.equal(currentSha256, input.sha256,
          `Baseline is stale for ${input.path}; rebuild the current-rules baseline`)
      }
    }
    const { recipes, sourceSnapshots } = await loadRecipes()
    const recipeSummary = recipes.map(({ id, name, color, sourceSnapshot, sourceId }) => ({
      id, name, color, sourceId: sourceId ?? null, sourceSnapshot,
    }))
    const matchups = recipes.length * (recipes.length + 1) / 2
    const seedsPerMatchup = 2
    const exchangesPerSeed = 4
    const expectedTotal = matchups * seedsPerMatchup * exchangesPerSeed

    if (args.planOnly) {
      console.log(JSON.stringify({
        mode: 'plan-only',
        writesFiles: false,
        paths: { baselinePath, candidatePath, reportPath },
        seedBase,
        level,
        recipeCount: recipes.length,
        matchupCount: matchups,
        seedsPerMatchup,
        exchangesPerSeed,
        expectedGames: expectedTotal,
        sourceSnapshots,
        recipes: recipeSummary,
      }, null, 2))
    } else {
      await mkdir(path.dirname(candidatePath), { recursive: true })
      const temporaryCandidatePath = `${candidatePath}.tmp-${randomUUID()}.mjs`
      let candidateMetafile
      try {
        const candidateBuild = await build({
          entryPoints: ['src/game/index.ts'],
          bundle: true,
          platform: 'node',
          format: 'esm',
          outfile: temporaryCandidatePath,
          metafile: true,
        })
        candidateMetafile = candidateBuild.metafile
        await copyFile(temporaryCandidatePath, candidatePath, constants.COPYFILE_EXCL)
      } finally {
        await unlink(temporaryCandidatePath).catch(() => {})
      }

      const candidateSourceManifest = await auditCandidateInputs(candidateMetafile, baselineManifest)
      const candidateBytes = await readFile(candidatePath)
      const candidateSha256 = hash(candidateBytes)
      assert.notEqual(baselineSha256, candidateSha256, 'Baseline and candidate bundles must differ')

      const baseline = await import(pathToFileURL(baselinePath).href)
      const candidate = await import(pathToFileURL(candidatePath).href)
      let initialStatePreflightChecks = 0
      for (let left = 0; left < recipes.length; left++) {
        for (let right = left; right < recipes.length; right++) {
          const seed = seedBase + left * 10000 + right * 100
          for (const firstPlayerId of ['player-one', 'player-two']) {
            let baselineInitialState
            try {
              baselineInitialState = baseline.createCustomDeckMatch(seed, recipes[left], recipes[right], firstPlayerId)
            } catch (cause) {
              throw new Error(`Baseline compatibility preflight failed for ${recipes[left].id} vs ${recipes[right].id}: ${String(cause)}`)
            }
            let candidateInitialState
            try {
              candidateInitialState = candidate.createCustomDeckMatch(seed, recipes[left], recipes[right], firstPlayerId)
            } catch (cause) {
              throw new Error(`Candidate setup preflight failed for ${recipes[left].id} vs ${recipes[right].id}: ${String(cause)}`)
            }
            assert.deepStrictEqual(baselineInitialState, candidateInitialState,
              `Initial-state preflight mismatch for ${recipes[left].id} vs ${recipes[right].id} (${firstPlayerId})`)
            initialStatePreflightChecks++
          }
        }
      }

      const jobs = []
      for (let left = 0; left < recipes.length; left++) {
        for (let right = left; right < recipes.length; right++) {
          for (let repeat = 0; repeat < seedsPerMatchup; repeat++) {
            const seed = seedBase + left * 10000 + right * 100 + repeat
            for (const candidatePlayerId of ['player-one', 'player-two']) {
              for (const firstPlayerId of ['player-one', 'player-two']) {
                jobs.push({ seed, left: recipes[left], right: recipes[right], firstPlayerId, candidatePlayerId })
              }
            }
          }
        }
      }
      assert.equal(jobs.length, expectedTotal)

      const rows = new Array(jobs.length)
      const workers = [
        new Worker(new URL(import.meta.url), { workerData: { baselinePath, candidatePath, level } }),
        new Worker(new URL(import.meta.url), { workerData: { baselinePath, candidatePath, level } }),
      ]
      let next = 0
      let completed = 0
      try {
        await Promise.all(workers.map(async worker => {
          while (next < jobs.length) {
            const index = next++
            rows[index] = await new Promise((resolve, reject) => {
              const cleanup = () => {
                worker.off('message', receive)
                worker.off('error', fail)
                worker.off('exit', exited)
              }
              const receive = value => { cleanup(); resolve(value) }
              const fail = error => { cleanup(); reject(error) }
              const exited = code => fail(new Error(`worker exited ${code}`))
              worker.once('message', receive)
              worker.once('error', fail)
              worker.once('exit', exited)
              worker.postMessage(jobs[index])
            })
            completed++
            if (completed % 24 === 0) console.log(`${completed}/${jobs.length}`)
          }
        }))
      } finally {
        await Promise.all(workers.map(worker => worker.terminate()))
      }

      const valid = rows.filter(row => !row.error)
      const wins = valid.filter(row => row.candidateWon).length
      const report = {
        status: valid.length === jobs.length && rows.every(row => row.initialStateParity) ? 'PASS' : 'FAIL',
        method: `Matched AI-vs-AI comparison: baseline and candidate bundles receive the same recipes, seeds, player-seat and first-player assignments; all recipe pairings are preflighted for identical initial states before play, then each match independently verifies parity. When a current-rules baseline manifest is present, candidate source paths must match it exactly and candidate rule/data hashes must match the baseline. Matches use Lv.${level} policies, persistent per-player strategy memory, a deterministic search clock, and a 500-action cap. This measures AI-vs-AI results, not human win rate.`,
        matchedDesign: {
          sameSeedForAllFourExchanges: true,
          policySeats: ['player-one', 'player-two'],
          firstPlayerAssignments: ['player-one', 'player-two'],
          persistentMemoryPerPlayer: true,
          level,
          deterministicSearchClock: true,
          actionCap: 500,
          initialStatePreflightChecks,
          initialStateParityChecks: rows.filter(row => row.initialStateParity).length,
        },
        baselineBundle: { path: baselinePath, sha256: baselineSha256 },
        baselinePolicyManifest: baselineManifest ? {
          path: baselinePath.replace(/\.mjs$/i, '-manifest.json'),
          policyRef: baselineManifest.policyRef,
          policyInputsSha256: baselineManifest.policyInputsSha256,
          currentRuleAndDataInputsSha256: baselineManifest.currentRuleAndDataInputsSha256,
        } : null,
        candidateSourceManifest,
        candidateBundle: { path: candidatePath, sha256: candidateSha256 },
        sourceSnapshots,
        recipeIds: recipes.map(recipe => recipe.id),
        recipes: recipeSummary,
        recipesSha256: hash(JSON.stringify(recipes)),
        seedBase,
        level,
        recipeCount: recipes.length,
        matchupCount: matchups,
        seedsPerMatchup,
        exchangesPerSeed,
        total: rows.length,
        completed: valid.length,
        candidateWins: wins,
        baselineWins: valid.length - wins,
        candidateWinRate: valid.length ? wins / valid.length : null,
        byColor: [...new Set(recipes.map(recipe => recipe.color))].map(color => {
          const games = valid.filter(row => row.candidateColor === color)
          const baselineGames = valid.filter(row =>
            (row.candidatePlayerId === 'player-one' ? row.right : row.left) === color)
          return {
            color,
            games: games.length,
            wins: games.filter(row => row.candidateWon).length,
            baselineGames: baselineGames.length,
            baselineWins: baselineGames.filter(row => !row.candidateWon).length,
          }
        }),
        failureDistribution: summarizeFailures(rows),
        rows,
      }
      await mkdir(path.dirname(reportPath), { recursive: true })
      await writeFile(reportPath, JSON.stringify(report, null, 2), { flag: 'wx' })
      console.log(JSON.stringify({
        ...report,
        rows: undefined,
        reportPath,
      }, null, 2))
      if (report.status !== 'PASS') process.exitCode = 1
    }
  }
}

async function loadRecipes() {
  const snapshots = await Promise.all(communitySnapshotPaths.map(async snapshotPath => {
    const bytes = await readFile(snapshotPath)
    const snapshot = JSON.parse(bytes.toString('utf8'))
    return {
      path: snapshotPath,
      sha256: hash(bytes),
      retrievedAt: snapshot.retrievedAt ?? null,
      method: snapshot.method ?? null,
      decks: snapshot.decks,
    }
  }))
  // Snapshots are deliberately newest-first, so a repeated sourceId uses the latest capture.
  const communityRecipes = acceptedCommunityIds.map(sourceId => {
    const snapshot = snapshots.find(candidate => candidate.decks.some(deck => deck.sourceId === sourceId))
    const source = snapshot?.decks.find(deck => deck.sourceId === sourceId)
    if (!source) throw new Error(`Accepted Cookierift source ${sourceId} is missing from both snapshots`)
    if (!source.color || !source.name) throw new Error(`Cookierift source ${sourceId} is missing its name or color`)
    return {
      id: `cookierift-${sourceId}`,
      sourceId,
      name: source.name,
      author: source.author ?? null,
      color: source.color,
      format: 'standard',
      entries: parseEntries(source.main, `Cookierift ${sourceId} main deck`),
      extraDeckEntries: parseEntries(source.extra ?? '', `Cookierift ${sourceId} EXTRA deck`),
      createdAt: snapshot.retrievedAt ?? '2026-10-10',
      updatedAt: snapshot.retrievedAt ?? '2026-10-10',
      sourceSnapshot: snapshot.path,
    }
  })
  const bs12Recipes = await Promise.all(bs12Colors.map(async color => {
    const sourceSnapshot = `data/decks/bs12-${color}-arena.json`
    const sourceBytes = await readFile(sourceSnapshot)
    const recipe = JSON.parse(sourceBytes.toString('utf8'))
    return {
      ...recipe,
      id: `s3-defense-${color}`,
      color,
      format: 'standard',
      createdAt: '2026-10-09',
      updatedAt: '2026-10-09',
      sourceSnapshot,
      sourceSnapshotSha256: hash(sourceBytes),
    }
  }))
  const userBs12SnapshotPath = 'data/decks/bs12-red-korean-starter.json'
  const userBs12SnapshotBytes = await readFile(userBs12SnapshotPath)
  const userBs12Snapshot = JSON.parse(userBs12SnapshotBytes.toString('utf8'))
  const userBs12Recipe = {
    ...userBs12Snapshot,
    id: 'bs12-red-korean-starter',
    color: 'red',
    format: 'standard',
    sourceSnapshot: userBs12SnapshotPath,
    sourceSnapshotSha256: hash(userBs12SnapshotBytes),
  }
  const recipes = [...bs12Recipes, userBs12Recipe, ...communityRecipes]
  assert.equal(recipes.length, 7 + acceptedCommunityIds.length,
    'Expected six BS12 Arena recipes, one Korean BS12 starter, and all accepted Cookierift recipes')
  assert.equal(new Set(recipes.map(recipe => recipe.id)).size, recipes.length, 'Recipe IDs must be unique')
  for (const recipe of recipes) {
    const mainTotal = recipe.entries.reduce((sum, entry) => sum + entry.count, 0)
    assert.equal(mainTotal, 60, `${recipe.id} must contain exactly 60 main-deck cards`)
    assert.ok(recipe.extraDeckEntries.every(entry => Number.isSafeInteger(entry.count) && entry.count > 0),
      `${recipe.id} has an invalid EXTRA entry`)
  }
  const sourceSnapshots = [
    ...snapshots.map(({ path: snapshotPath, sha256, retrievedAt, method }) => ({
      path: snapshotPath, sha256, retrievedAt, method,
    })),
    ...bs12Recipes.map(recipe => ({ path: recipe.sourceSnapshot, sha256: recipe.sourceSnapshotSha256 })),
    { path: userBs12Recipe.sourceSnapshot, sha256: userBs12Recipe.sourceSnapshotSha256, method: 'User-provided PVP KR BS12 starter deck image; printed card numbers and copy counts transcribed without substitutions.' },
  ]
  return { recipes, sourceSnapshots }
}

function parseEntries(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a card list string`)
  if (!value.trim()) return []
  return value.trim().split(/\s+/).map(part => {
    const match = /^([^:]+):(\d+)$/.exec(part)
    if (!match) throw new Error(`${label} contains invalid entry ${part}`)
    const count = Number(match[2])
    if (!Number.isSafeInteger(count) || count < 1) throw new Error(`${label} contains invalid count in ${part}`)
    return { cardNumber: match[1], count }
  })
}

function summarizeFailures(rows) {
  const failed = rows.filter(row => row.error)
  const byFailureType = {}
  const byRecipePair = {}
  for (const row of failed) {
    const type = row.failureType ?? 'unknown'
    byFailureType[type] = (byFailureType[type] ?? 0) + 1
    const key = `${row.leftRecipe} vs ${row.rightRecipe}`
    const pair = byRecipePair[key] ??= {
      leftRecipe: row.leftRecipe,
      rightRecipe: row.rightRecipe,
      failedMatches: 0,
      unfinishedMatches: 0,
      actionCapFailures: 0,
      byFailureType: {},
    }
    pair.failedMatches++
    if (row.stateStatus !== 'finished') pair.unfinishedMatches++
    if (type === 'action-cap-500') pair.actionCapFailures++
    pair.byFailureType[type] = (pair.byFailureType[type] ?? 0) + 1
  }
  return {
    failedMatches: failed.length,
    unfinishedMatches: failed.filter(row => row.stateStatus !== 'finished').length,
    actionCapFailures: failed.filter(row => row.failureType === 'action-cap-500').length,
    byFailureType,
    byRecipePair: Object.values(byRecipePair),
  }
}

function parseArguments(argv) {
  const options = { planOnly: false, help: false }
  const names = new Map([
    ['--baseline', 'baseline'],
    ['--candidate', 'candidate'],
    ['--report', 'report'],
    ['--seed-base', 'seedBase'],
    ['--level', 'level'],
  ])
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--plan-only') {
      options.planOnly = true
    } else if (argument === '--help' || argument === '-h') {
      options.help = true
    } else if (names.has(argument)) {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
      options[names.get(argument)] = value
    } else {
      throw new Error(`Unknown benchmark option: ${argument}`)
    }
  }
  return options
}

function resolveConfiguredPath(value) {
  return path.resolve(value)
}

function assertDistinctPaths(paths) {
  const entries = Object.entries(paths)
  for (let index = 0; index < entries.length; index++) {
    for (let other = index + 1; other < entries.length; other++) {
      const left = path.resolve(entries[index][1]).toLowerCase()
      const right = path.resolve(entries[other][1]).toLowerCase()
      if (left === right) throw new Error(`${entries[index][0]} and ${entries[other][0]} must use different paths`)
    }
  }
}

async function assertExists(filePath, label) {
  try {
    await stat(filePath)
  } catch {
    throw new Error(`${label} does not exist: ${filePath}`)
  }
}

async function assertDoesNotExist(filePath, label) {
  try {
    await stat(filePath)
    throw new Error(`${label} already exists; refusing to overwrite: ${filePath}`)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    throw error
  }
}
