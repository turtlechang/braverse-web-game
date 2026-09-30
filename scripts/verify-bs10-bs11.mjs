import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { preview } from 'vite'
import { makeInventory, sha256 } from './lib/bs10-bs11-verification.mjs'

const root = process.cwd()
const args = process.argv.slice(2)
const output = resolve('test-results/bs10-bs11-verification', new Date().toISOString().replace(/[:.]/g, '-'))
await mkdir(output, { recursive: true })
const datasetFiles = readdirSync('data/cards').filter((file) => /-bs(?:10|11)\.en\.json$/.test(file)).sort()
const records = datasetFiles.flatMap((file) => JSON.parse(readFileSync(resolve('data/cards', file), 'utf8')).cards)
if (records.length !== 323 || new Set(records.map((record) => record.cardNumber)).size !== records.length) throw new Error('BS10/BS11 dataset identity/count changed; review scope before execution')
const reviewed = JSON.parse(readFileSync('scripts/bs10-bs11-reviewed-expectations.json', 'utf8'))
const driverPaths = readdirSync('scripts').filter((path) => /^bs(?:10|11)-.*browser.*\.mjs$/.test(path) && path !== 'bs10-bs11-flip-browser.mjs').sort()
const references = driverPaths.map((path) => {
  const source = readFileSync(resolve('scripts', path), 'utf8')
  return { path: `scripts/${path}`, cardNumbers: [...new Set(source.match(/BS(?:10|11)-\d{3}(?:@\d+)?/g) ?? [])],
    forcedClicks: /force:\s*true/.test(source), programmaticClicks: /\.click\(\)/.test(source) && /\.evaluate\(/.test(source) }
})
const walk = (directory) => readdirSync(directory).sort().flatMap((name) => {
  const path = `${directory}/${name}`
  return statSync(path).isDirectory() ? walk(path) : [path]
})
// Conservative invalidation across all runtime, fixtures and UI. Documentation does not invalidate behavior evidence.
const fingerprintFiles = () => [...walk('src'), ...walk('data/cards'), 'package-lock.json', 'vite.config.ts',
  'scripts/lib/bs10-bs11-verification.mjs', 'scripts/bs10-bs11-flip-browser.mjs', 'scripts/bs10-bs11-reviewed-expectations.json']
const computeFingerprint = () => sha256(fingerprintFiles().filter(existsSync).sort().map((file) => `${file}:${sha256(readFileSync(file))}`).join('\n'))
const fingerprint = computeFingerprint()
const port = Number(process.env.BRAVERSE_VERIFICATION_PORT ?? 4186)
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid verification preview port')
const baseUrl = `http://127.0.0.1:${port}`
const provenance = { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean), fingerprint,
  node: process.version, generatedAt: new Date().toISOString(), timezone: 'Asia/Taipei', output }
const executions = []
const run = async (script, args = [], env = {}) => {
  const path = resolve(root, script)
  const log = resolve(output, `${executions.length}-${script.split('/').pop()}.log`)
  const result = await new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, [path, ...args], { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    child.stdout.on('data', (data) => { stdout += data; process.stdout.write(data) })
    child.stderr.on('data', (data) => { stdout += data; process.stderr.write(data) })
    child.on('error', reject)
    child.on('close', (code, signal) => resolveResult({ command: [process.execPath, script, ...args], code, signal, stdout }))
  })
  await writeFile(log, result.stdout)
  executions.push({ command: result.command, code: result.code, signal: result.signal, log })
  return result.code === 0
}
let evidence = []
let server
let executionPassed = true
try {
  if (!args.includes('--inventory-only')) {
    executionPassed = await run('node_modules/typescript/bin/tsc', ['-b']) && await run('node_modules/vite/bin/vite.js', ['build'])
    if (executionPassed) {
      server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } })
      executionPassed = await run('scripts/bs10-bs11-flip-browser.mjs', [], {
        BRAVERSE_BASE_URL: baseUrl, BRAVERSE_VERIFICATION_OUTPUT: output, BRAVERSE_VERIFICATION_FINGERPRINT: fingerprint,
      })
      if (existsSync(resolve(output, 'browser.json'))) evidence = JSON.parse(readFileSync(resolve(output, 'browser.json'), 'utf8')).results
      if (executionPassed && args.includes('--legacy')) {
        for (const path of driverPaths) {
          if (!await run(`scripts/${path}`, [], {
            BRAVERSE_BASE_URL: baseUrl,
            BRAVERSE_BS10_BASE_URL: baseUrl,
          })) executionPassed = false
        }
      }
    }
  }
} catch (error) {
  executionPassed = false
  executions.push({ code: null, error: error.stack ?? String(error) })
} finally { if (server) await new Promise((done, reject) => server.httpServer.close((error) => error ? reject(error) : done())) }
const finalFingerprint = computeFingerprint()
provenance.finalFingerprint = finalFingerprint
provenance.runtimeChangedDuringRun = finalFingerprint !== fingerprint
if (provenance.runtimeChangedDuringRun) executionPassed = false
const inventory = makeInventory(records, references, reviewed, evidence, finalFingerprint)
const fragments = inventory.flatMap((card) => card.effects)
const summary = {
  records: records.length, baseCards: new Set(records.map((record) => record.baseCardNumber)).size,
  sourceFragments: fragments.length, discoveredDrivers: references.length,
  localBrowserVerifiedFragments: fragments.filter((effect) => effect.status === 'local-browser-verified').length,
  needsIndependentExpectation: fragments.filter((effect) => effect.status === 'needs-independent-expectation').length,
  browserPassed: evidence.filter((row) => row.status === 'PASS').length, browserFailed: evidence.filter((row) => row.status === 'FAIL').length,
  legacyDriversExecuted: executions.filter((row) => row.command?.[1]?.startsWith('scripts/bs') && row.command[1] !== 'scripts/bs10-bs11-flip-browser.mjs').length,
  legacyDriversPassed: executions.filter((row) => row.command?.[1]?.startsWith('scripts/bs') && row.command[1] !== 'scripts/bs10-bs11-flip-browser.mjs' && row.code === 0).length,
  fullSeriesAccepted: false, executionPassed,
}
const report = { provenance, summary, executions, references, inventory,
  scope: 'Source-fragment inventory plus independently reviewed local FLIP batch. Source fragments and discovered drivers are not exhaustive semantic branches. Formal/online/CDN acceptance stays separate.' }
await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
const lines = [
  '# BS10／BS11 自動驗證結果', '', `HEAD: ${provenance.head}; Node: ${process.version}`, '',
  `正式資料 ${summary.records} 筆／${summary.baseCards} 基礎卡，來源片段 ${summary.sourceFragments}；發現 ${summary.discoveredDrivers} 支既有 Browser 腳本（只作導航）。`,
  `本輪 Browser ${summary.browserPassed} 通過／${summary.browserFailed} 失敗；${summary.localBrowserVerifiedFragments} 個 FLIP 片段完成指定分支與雙尺寸局部驗收。`,
  `仍有 ${summary.needsIndependentExpectation} 個來源片段未接入獨立預期；這不表示沒有舊測試，也不表示已完整列舉所有效果分支。`,
  `既有 Browser 驅動本輪執行 ${summary.legacyDriversExecuted} 支，${summary.legacyDriversPassed} 支結束碼為 0；此結果不自動升格為獨立預期覆蓋。`,
  '', '正式對戰／線上逐卡／直連 CDN：本輪未驗收。卡圖使用已目視的本機官方原圖。其他圖片失敗另記 Browser imageFailures。', '',
  '| 卡號 | 來源片段 | 本輪狀態 | 缺口 |', '| --- | --- | --- | --- |',
  ...inventory.flatMap((card) => card.effects.map((effect) => `| ${card.cardNumber} | ${effect.kind} | ${effect.status} | ${effect.missing.join(', ')} |`)),
]
await writeFile(resolve(output, 'report.md'), `${lines.join('\n')}\n`)
console.log(JSON.stringify({ ...summary, report: resolve(output, 'report.md') }, null, 2))
process.exitCode = !executionPassed ? 1 : args.includes('--strict') && fragments.some((effect) => effect.status !== 'local-browser-verified') ? 2 : 0
