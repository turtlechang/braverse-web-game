import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const entry = require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })
const module = await import(pathToFileURL(entry).href)
const chromium = module.chromium ?? module.default?.chromium
const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outputDir = resolve(root, 'test-results/bs11-031-activate-continuation-browser')
mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) {
    for (const scenario of ['positive', 'negative']) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(12000)
      const evidence = { scenario, viewport, status: 'FAIL', errors: [] }
      page.on('pageerror', (error) => evidence.errors.push(error.message))
      try {
        const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
        url.searchParams.set('test-state', `bs11-031-activate-continuation:${scenario}`)
        url.searchParams.set('contract-card', 'BS11-092')
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
        await page.locator('.game-shell').waitFor({ state: 'visible' })
        const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs11-031-marked-activate-cookie"]')
        await source.waitFor({ state: 'visible' })
        const skill = source.locator('.skill-action')
        await skill.waitFor({ state: 'visible' })
        evidence.skillEnabled = await skill.isEnabled()
        if (scenario === 'positive') {
          assert.equal(evidence.skillEnabled, true)
          await skill.click({ force: true })
          const effect = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await effect.waitFor({ state: 'visible' })
          await effect.getByRole('button', { name: '確認發動', exact: true }).click()
          for (let step = 0; step < 15; step += 1) {
            const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
            if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {})
            if (await page.locator('.hand-discard-modal:visible').count()) break
            await page.waitForTimeout(100)
          }
          const discard = page.locator('.hand-discard-modal:visible')
          await discard.waitFor({ state: 'visible' })
          evidence.discardPanel = await discard.innerText()
          assert.match(evidence.discardPanel, /必須選擇 2 張手牌棄置/)
          for (let index = 0; index < 2; index += 1) {
            await discard.locator('.hand-discard-options button:not(.is-selected)').first().click()
          }
          await discard.getByRole('button', { name: '確認棄置 (2)', exact: true }).click()
          const resumed = page.locator('.effect-panel[role="alertdialog"]:visible').last()
          await resumed.waitFor({ state: 'visible' })
          await resumed.getByRole('button', { name: '確認發動', exact: true }).click()
          await page.waitForFunction(() => (window.__braverseContractTrace ?? [])
            .some((entry) => entry.commandKind === 'resolve-opponent-hand-discard'))
        } else {
          assert.equal(evidence.skillEnabled, false)
          assert.equal(await page.locator('.hand-discard-modal:visible').count(), 0)
        }
        evidence.after = await page.evaluate(() => ({
          hand: document.querySelectorAll('.bottom-field .hand-card-wrap').length,
          trace: (window.__braverseContractTrace ?? []).map((entry) => ({ commandKind: entry.commandKind, steps: entry.steps })),
        }))
        assert.equal(evidence.after.hand, scenario === 'positive' ? 0 : 1)
        assert.equal(evidence.after.trace.some((entry) => entry.commandKind === 'resolve-opponent-hand-discard'),
          scenario === 'positive')
        assert.deepEqual(evidence.errors, [])
        evidence.status = 'PASS'
      } catch (error) {
        evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
        evidence.debug = await page.locator('[role="dialog"],[role="alertdialog"]').allTextContents().catch(() => [])
        evidence.trace = await page.evaluate(() => (window.__braverseContractTrace ?? []).map((entry) => ({
          commandKind: entry.commandKind, steps: entry.steps,
        }))).catch(() => [])
      } finally {
        console.log(`${evidence.status} BS11-031 continuation ${scenario} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
        results.push(evidence)
        await page.close()
      }
    }
  }
} finally { await browser.close() }
const artifactPath = resolve(outputDir, `bs11-031-activate-continuation-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ summary, results }, null, 2))
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
