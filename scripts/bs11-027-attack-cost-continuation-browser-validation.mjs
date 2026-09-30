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
const outputDir = resolve(root, 'test-results/bs11-027-attack-cost-continuation-browser')
mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of ['positive', 'negative']) {
    const page = await browser.newPage({ viewport })
    page.setDefaultTimeout(12000)
    const evidence = { scenario, viewport, status: 'FAIL', errors: [] }
    page.on('pageerror', (error) => evidence.errors.push(error.message))
    try {
      const url = new URL('/', process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')
      url.searchParams.set('test-state', `bs11-027-attack-cost-continuation:${scenario}`)
      url.searchParams.set('contract-card', 'BS11-023')
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor({ state: 'visible' })
      const source = page.locator('.bottom-field .combat-card-wrap').first()
      const attackable = source.locator('.card-face.is-attackable').first()
      evidence.before = await page.evaluate(() => ({
        attacker: document.querySelector('.bottom-field .combat-card-wrap')?.textContent?.trim(),
        targetHp: Number(document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
      }))
      if (scenario === 'positive') {
        await attackable.waitFor({ state: 'visible' })
        await attackable.click()
        await page.locator('[data-testid="attack-payment-panel"]:visible').waitFor({ state: 'visible' })
        for (let index = 0; index < 2; index += 1) {
          await page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first().click()
        }
        await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first().click()
        await page.waitForFunction(() => (window.__braverseContractTrace ?? [])
          .some((entry) => entry.commandKind === 'declare-attack'))
        for (let step = 0; step < 20; step += 1) {
          const skip = page.getByRole('button', { name: '略過目前演出', exact: true }).first()
          if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {})
          const afterHp = await page.locator('.top-field .combat-card-wrap .hp-card-stack').first().getAttribute('aria-label')
          if (afterHp?.includes(`HP 卡 ${evidence.before.targetHp - 1} 張`)) break
          await page.waitForTimeout(100)
        }
      } else {
        assert.equal(await attackable.count(), 0)
        assert.match(evidence.before.attacker, /能量不足：需要 2， 目前可用 1/)
      }
      evidence.after = await page.evaluate(() => ({
        targetHp: Number(document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        trace: (window.__braverseContractTrace ?? []).map((entry) => ({ commandKind: entry.commandKind, steps: entry.steps })),
        rested: document.querySelectorAll('.bottom-field .support-card-wrap .card-face.is-rested').length,
      }))
      assert.equal(evidence.before.targetHp - evidence.after.targetHp, scenario === 'positive' ? 1 : 0)
      assert.equal(evidence.after.rested, scenario === 'positive' ? 2 : 0)
      assert.equal(evidence.after.trace.some((entry) => entry.commandKind === 'declare-attack'), scenario === 'positive')
      assert.deepEqual(evidence.errors, [])
      evidence.status = 'PASS'
    } catch (error) {
      evidence.error = error instanceof Error ? error.stack ?? error.message : String(error)
      evidence.debug = await page.locator('[role="dialog"],[role="alertdialog"]').allTextContents().catch(() => [])
    } finally {
      console.log(`${evidence.status} BS11-027 continuation ${scenario} ${viewport.width}x${viewport.height}${evidence.error ? `: ${evidence.error.split('\n')[0]}` : ''}`)
      results.push(evidence)
      await page.close()
    }
  }
} finally { await browser.close() }
const artifactPath = resolve(outputDir, `bs11-027-attack-cost-continuation-browser-${Date.now()}.json`)
const summary = { total: results.length, passed: results.filter((entry) => entry.status === 'PASS').length }
writeFileSync(artifactPath, JSON.stringify({ summary, results }, null, 2))
console.log(JSON.stringify({ artifactPath, summary }))
if (summary.passed !== summary.total) process.exitCode = 1
