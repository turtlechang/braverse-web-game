import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { build } from 'esbuild'

const directory = 'output/ai-s3-finalists'
const hash = value => createHash('sha256').update(value).digest('hex')
if (!isMainThread) {
  const baseline = await import(`../${directory}/baseline-engine.mjs`)
  const candidate = await import(`../${directory}/candidate-engine.mjs`)
  parentPort.on('message', job => {
    let state = baseline.createCustomDeckMatch(job.seed, job.left, job.right, job.firstPlayerId)
    const memories = {}
    let error = null, actions = 0
    try {
      for (; actions < 500 && state.status !== 'finished'; actions++) {
        const player = baseline.getActingPlayerId(state)
        const engine = player === job.candidatePlayerId ? candidate : baseline
        const decision = engine.takeAiStep(state, player, {
          level: 5, seed: job.seed, searchNow: () => 0, memory: memories[player],
        })
        if (decision.reason?.strategyMemory) memories[player] = decision.reason.strategyMemory
        if (decision.action === 'error' || decision.state === state) {
          throw new Error(decision.error ?? `No progress: ${decision.description}`)
        }
        state = decision.state
      }
      if (state.status !== 'finished') throw new Error('500 action cap reached')
      if (!state.result?.winnerId) throw new Error('Finished match has no winner')
    } catch (cause) { error = String(cause) }
    parentPort.postMessage({
      seed: job.seed, left: job.left.color, right: job.right.color,
      firstPlayerId: job.firstPlayerId, candidatePlayerId: job.candidatePlayerId,
      candidateColor: job.candidatePlayerId === 'player-one' ? job.left.color : job.right.color,
      winner: state.result?.winnerId ?? null, actions, error,
      candidateWon: !error ? state.result?.winnerId === job.candidatePlayerId : null,
      ...(error ? { failedState: state } : {}),
    })
  })
} else {
  // Baseline is frozen before the production edit. Never silently replace it.
  const baselineBytes = await readFile(`${directory}/baseline-engine.mjs`)
  await build({entryPoints:['src/game/index.ts'],bundle:true,platform:'node',format:'esm',outfile:`${directory}/candidate-engine.mjs`})
  const candidateBytes = await readFile(`${directory}/candidate-engine.mjs`)
  assert.notEqual(hash(baselineBytes), hash(candidateBytes))
  const colors = ['blue','green','yellow','red','purple','black']
  const recipes = await Promise.all(colors.map(async color => ({
    ...JSON.parse(await readFile(`data/decks/bs12-${color}-arena.json`,'utf8')),
    color, id: `s3-defense-${color}`, format: 'standard',
    createdAt: '2026-10-09', updatedAt: '2026-10-09',
  })))
  const jobs = []
  for(let left=0;left<colors.length;left++) for(let right=left;right<colors.length;right++) {
    for(let repeat=0;repeat<2;repeat++) for(const candidatePlayerId of ['player-one','player-two']) {
      for(const firstPlayerId of ['player-one','player-two']) jobs.push({
        seed: 202610090 + left*10000 + right*100 + repeat,
        left: recipes[left],right:recipes[right],firstPlayerId,candidatePlayerId,
      })
    }
  }
  const rows = new Array(jobs.length)
  const workers = [new Worker(new URL(import.meta.url)),new Worker(new URL(import.meta.url))]
  let next = 0, completed = 0
  try {
    await Promise.all(workers.map(async worker => {
      while(next<jobs.length) {
        const index = next++
        rows[index] = await new Promise((resolve,reject) => {
          const cleanup=()=>{worker.off('message',receive);worker.off('error',fail);worker.off('exit',exited)}
          const receive=value=>{cleanup();resolve(value)}
          const fail=error=>{cleanup();reject(error)}
          const exited=code=>fail(new Error(`worker exited ${code}`))
          worker.once('message',receive);worker.once('error',fail);worker.once('exit',exited)
          worker.postMessage(jobs[index])
        })
        completed++
        if(completed%12===0) console.log(`${completed}/${jobs.length}`)
      }
    }))
  } finally {await Promise.all(workers.map(worker=>worker.terminate()))}
  const valid = rows.filter(row=>!row.error)
  const wins = valid.filter(row=>row.candidateWon).length
  const report = {
    status: valid.length === jobs.length ? 'PASS' : 'FAIL',
    method: 'Same-seed mixed baseline/candidate Lv5, persistent per-player memory, deterministic clock, 500 action cap; 21 color pairs x 2 seeds x 2 policy seats x 2 first-player assignments. Existing six BS12 recipes; not reconstructed photo decks.',
    baselineSha256: hash(baselineBytes), candidateSha256: hash(candidateBytes),
    total: rows.length, completed: valid.length, candidateWins:wins, baselineWins:valid.length-wins,
    candidateWinRate: wins/valid.length,
    byColor: colors.map(color=>{
      const games=valid.filter(r=>r.candidateColor===color)
      const baselineGames=valid.filter(r=>(r.candidatePlayerId==='player-one'?r.right:r.left)===color)
      return{color,games:games.length,wins:games.filter(r=>r.candidateWon).length,
        baselineGames:baselineGames.length,baselineWins:baselineGames.filter(r=>!r.candidateWon).length}
    }),
    recipesSha256: hash(JSON.stringify(recipes)), rows,
  }
  await writeFile(`${directory}/matched-comparison.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify({...report,rows:undefined},null,2))
  if(report.status!=='PASS') process.exitCode=1
}
