import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4196)
const baseUrl = `http://127.0.0.1:${port}`
const output = 'test-results/bs8-extra-variant-effects'
const records = JSON.parse(await readFile('data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json', 'utf8')).cards
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', windowsHide: true })
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = []
await mkdir(output, { recursive: true })
const snapshot = async page => ({
  hand: Number(await page.locator('.bottom-field .row-stat-value').last().innerText()),
  support: await page.locator('.bottom-field .support-card-wrap').count(),
  activeSupport: await page.locator('.bottom-field .support-card-wrap .card-face:not(.is-rested)').count(),
  battle: await page.locator('.bottom-field .combat-card-wrap').count(),
  trash: Number((await page.locator('.bottom-field .discard-zone').getAttribute('title')).match(/(\d+) 張/)[1]),
  opponentHp: await page.locator('.top-field .badge-hp').evaluateAll(nodes => nodes.map(node => parseInt(node.textContent, 10))),
})
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(baseUrl)).ok) break } catch { /* preview starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const exactId of ['BS8-005@1', 'BS8-069@1', 'BS8-090@1', 'BS8-104@1', 'BS8-104@2']) {
      const record = records.find(card => card.cardNumber === exactId)
      const base = record.baseCardNumber
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        page.setDefaultTimeout(7000)
        const label = `${viewport.width}-${exactId}-${positive ? 'positive' : 'negative'}`
        const route = `${positive ? 'card' : 'card-negative'}:${exactId}`
        const errors = []
        let exactImageRequested = false
        page.on('pageerror', error => errors.push(error.message))
        page.on('request', request => { if (request.url() === record.imageUrl) exactImageRequested = true })
        try {
          await page.goto(`${baseUrl}?test-state=${encodeURIComponent(route)}&contract-card=${base}`)
          const dock = page.getByLabel('玩家 EXTRA Deck 1 張', { exact: true })
          await dock.waitFor()
          assert.equal(await dock.getAttribute('data-extra-deck-ready'), String(positive))
          const beforeEntry = await snapshot(page)
          await dock.click()
          const dialog = page.getByRole('dialog', { name: '玩家 EXTRA Deck', exact: true })
          const entry = dialog.locator('.extra-deck-card-entry')
          assert.equal(await entry.count(), 1)
          assert.equal(await entry.locator('.extra-deck-card-details small').first().innerText(), base)
          assert.match(await entry.innerText(), new RegExp(record.name))
          await page.waitForTimeout(100)
          assert.ok(exactImageRequested || await entry.locator(`img[src="${record.imageUrl}"]`).count(), 'exact variant image URL must be rendered/requested')
          const play = dialog.getByRole('button', { name: '從 EXTRA 登場', exact: true })
          if (!positive) {
            assert.equal(await play.count(), 0)
            await dialog.getByText('目前無法登場', { exact: true }).waitFor()
            assert.deepEqual(await snapshot(page), beforeEntry)
            const trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
            assert.equal(trace.some(item => ['play-extra-deck-cookie', 'awaken-cookie', 'begin-activate-skill', 'resolve-ability-effect'].includes(item.commandKind)), false)
            assert.deepEqual(errors, [])
            await page.screenshot({ path: `${output}/${label}.png` })
            results.push({ label, exactId, base, route, status: 'PASS', exactImageRequested, expectedImageUrl: record.imageUrl, entryBlocked: true, beforeEntry, after: await snapshot(page), trace })
            continue
          }
          await play.click()
          const panel = page.locator('.effect-panel')
          await panel.waitFor()
          const before = await snapshot(page)
          if (base === 'BS8-104') {
            assert.equal(await panel.locator('.effect-panel-primary-action').isEnabled(), false)
            await panel.getByRole('button').filter({ hasText: 'bs8-104-on-play-discard' }).click()
            await panel.locator('.effect-panel-primary-action').click()
          }
          if (base === 'BS8-005') {
            const targets = panel.locator('.effect-candidates-target button')
            const count = await targets.count()
            assert.ok(count > 0)
            for (let index = count - 1; index >= 0; index--) await targets.nth(index).click()
          } else {
            const target = { 'BS8-069': 'bs8-069-green-trash', 'BS8-090': 'bs8-090-blue-target', 'BS8-104': 'bs8-104-purple-return' }[base]
            await panel.getByRole('button').filter({ hasText: target }).click()
          }
          await panel.locator('.effect-panel-primary-action').click()
          await panel.waitFor({ state: 'hidden' })
          const after = await snapshot(page)
          if (base === 'BS8-005') assert.deepEqual(after.opponentHp, before.opponentHp.map(hp => hp - 1))
          if (base === 'BS8-069') {
            assert.equal(after.support, before.support + 1)
            assert.equal(after.activeSupport, before.activeSupport + 1)
            assert.equal(after.trash, before.trash - 1)
          }
          if (base === 'BS8-090') {
            assert.equal(after.hand, before.hand + 1)
            assert.equal(after.battle, before.battle - 1)
          }
          if (base === 'BS8-104') {
            assert.equal(after.hand, before.hand)
            assert.equal(after.trash, before.trash)
            assert.equal(await page.locator('.bottom-hand .card-face[title="bs8-104-purple-return"]').count(), 1)
          }
          const trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
          assert.ok(trace.some(item => item.commandKind === 'resolve-ability-effect'))
          assert.deepEqual(errors, [])
          await page.screenshot({ path: `${output}/${label}.png` })
          results.push({ label, exactId, base, route, status: 'PASS', exactImageRequested, expectedImageUrl: record.imageUrl, beforeEntry, before, after, trace })
          console.log(`PASS ${label}`)
        } catch (error) {
          results.push({ label, exactId, base, route, status: 'FAIL', error: error.message })
          console.log(`FAIL ${label}: ${error.message}`)
        } finally { await page.close() }
      }
    }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Exact variant card/card-negative fixtures, real EXTRA entry and OnPlay UI; negative checks entry condition. Not attack-Then, full match, online, or image-load acceptance.', results }, null, 2))
  await browser.close()
  server.kill()
}
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
