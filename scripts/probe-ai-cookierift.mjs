import { readFile, writeFile } from 'node:fs/promises'
import * as game from '../output/ai-cookierift/baseline-engine.mjs'

const rows = [], examples = []
const full = process.env.BRAVERSE_FULL_PROBE === '1'
for (const color of ['blue', 'green', 'yellow', 'red', 'purple', 'black']) {
  const recipe = JSON.parse(await readFile(`data/decks/bs12-${color}-arena.json`, 'utf8'))
  const deck = {...recipe, id: color, createdAt:'2026-10-10', updatedAt:'2026-10-10'}
  let state = game.createCustomDeckMatch(202610100, deck, deck, 'player-one')
  const memories = {}
  let searched = 0
  for (let steps = 0; steps < (full?500:160) && state.status !== 'finished' && searched < (full?500:16); steps++) {
    const player = game.getActingPlayerId(state)
    const started = performance.now()
    const decision = game.takeAiStep(state, player, {level:5, seed:202610100, memory:memories[player]})
    const elapsedMs = performance.now()-started
    if (decision.reason?.strategyMemory) memories[player] = decision.reason.strategyMemory
    if (decision.reason?.lv4Search) {
      const search = decision.reason.lv4Search
      rows.push({color, steps, action:decision.action, elapsedMs, search})
      searched++
      if(search.stopReason==='time-budget' && search.nodesGenerated>0 && examples.length<12) {
        examples.push({color, state, player, memory:memories[player], action:decision.action, search})
      }
    }
    if (decision.action === 'error' || decision.state === state) throw new Error(decision.error ?? 'no progress')
    state = decision.state
  }
  if(full&&state.status!=='finished')throw new Error(`${color}: full probe did not finish`)
  console.log(color, searched,state.status)
}
const report = {total:rows.length, timeouts:rows.filter(r=>r.search.stopReason==='time-budget').length,
  discardedEvaluations:rows.filter(r=>r.search.stopReason==='time-budget'&&r.search.nodesGenerated>0).length, rows}
await writeFile(`output/ai-cookierift/runtime-probe${full?'-full':''}.json`, JSON.stringify(report,null,2))
await writeFile(`output/ai-cookierift/runtime-examples${full?'-full':''}.json`, JSON.stringify(examples,null,2))
console.log(JSON.stringify({...report, rows:undefined}))
