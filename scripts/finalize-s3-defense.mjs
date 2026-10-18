import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { build as bundle } from 'esbuild'

const directory = 'output/ai-s3-finalists'
const readJson = async name => JSON.parse(await readFile(`${directory}/${name}`, 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const report = await readJson('matched-comparison.json')
assert.equal(report.status, 'PASS')
assert.equal(report.rows.length, 168)
assert.equal(report.completed, 168)
assert.equal(report.rows.filter(row=>row.candidateWon).length, 85)
assert.ok(report.rows.every(row=>!row.error && row.winner && row.actions<=500))
assert.equal(hash(await readFile(`${directory}/baseline-engine.mjs`)),report.baselineSha256)
assert.equal(hash(await readFile(`${directory}/candidate-engine.mjs`)),report.candidateSha256)
const currentEngine = await bundle({entryPoints:['src/game/index.ts'],bundle:true,platform:'node',format:'esm',write:false})
assert.equal(hash(currentEngine.outputFiles[0].contents),report.candidateSha256,
  'Final production code must match the candidate used in the benchmark')
const grouped = Map.groupBy(report.rows, row=>`${row.left}/${row.right}`)
assert.equal(grouped.size, 21)
for(const rows of grouped.values()) {
  assert.equal(rows.length, 8)
  assert.equal(new Set(rows.map(row=>`${row.seed}/${row.candidatePlayerId}/${row.firstPlayerId}`)).size, 8)
  for(const seat of ['player-one','player-two']) {
    assert.equal(rows.filter(row=>row.candidatePlayerId===seat).length, 4)
    assert.equal(rows.filter(row=>row.firstPlayerId===seat).length, 4)
  }
}
const full = await readJson('full-vitest-exit.json')
const build = await readJson('build-lint-exit.json')
const browser = await readJson('browser-exit.json')
assert.equal(full.exitCode,0)
assert.equal(build.buildExitCode,0)
assert.equal(build.lintExitCode,0)
assert.equal(browser.exitCode,0)
assert.equal((await readJson('browser/ai-browser-validation.json')).status,'PASS')
const fullLog = await readFile(`${directory}/full-vitest.log`,'utf8')
const targetedLog = await readFile(`${directory}/targeted-final2.log`,'utf8')
assert.match(targetedLog,/Tests\s+37 passed/)
const files = Number(fullLog.match(/Test Files\s+(\d+) passed/)?.[1])
const tests = Number(fullLog.match(/Tests\s+(\d+) passed/)?.[1])
assert.ok(files>800 && tests>17000)
const paths = [
  'src/game/ai/strategy/defensive-reserve.ts','src/game/ai/strategy/version.ts',
  'src/game/ai/strategy/s3-defense-reservation.test.ts','scripts/benchmark-s3-defense.mjs',
]
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path))])))
const attachmentRoot = '.codex-remote-attachments/01a11c19-9046-75d0-838c-05fe38b125f8/8b0d7dcf-d8f0-453a-a43c-be37d8e21843'
const imageHashes = Object.fromEntries(await Promise.all([
  '1-15106.jpg','2-15105.jpg','3-15104.jpg','4-15103.jpg',
].map(async name=>[name,hash(await readFile(`${attachmentRoot}/${name}`))])))
const result = {
  status:'PASS',generatedAt:new Date().toISOString(),files,tests,
  targetedFiles:5,targetedTests:37,sourceHashes,imageHashes,
  benchmarkAudit:{matches:168,candidateWins:85,baselineWins:83,allCompleted:true,
    baselineSha256:report.baselineSha256,candidateSha256:report.candidateSha256},
  commands:[full,{command:'npm.cmd run build',exitCode:build.buildExitCode},
    {command:'npm.cmd run lint',exitCode:build.lintExitCode},browser],
  limitations:[
    'The four photographed decks were not reconstructed or imported.',
    'The X post could not be fetched; attached images are the source.',
    '168 paired games do not prove a significant overall win-rate improvement.',
    'General AI Browser is not per-card online acceptance.',
  ],
}
await writeFile(`${directory}/verification-evidence.json`,JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
