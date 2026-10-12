import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = process.env.BRAVERSE_ST6005_OUTPUT ?? 'output/st6-st10/st6-005-browser-candidate'
await mkdir(output, { recursive: true })
const port = 4217
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
const rows = []
let browser
const publicState = page => page.evaluate(() => ({
  own: [...document.querySelectorAll('.bottom-field .combat-card-wrap')].map(source => ({
    id: source.getAttribute('data-card-instance-id'), hp: source.querySelector('.badge-hp').textContent.trim(),
    rested: source.querySelector('.card-face').classList.contains('is-rested'),
  })),
  foe: [...document.querySelectorAll('.top-field .combat-card-wrap .badge-hp')].map(hp => hp.textContent.trim()),
  support: [...document.querySelectorAll('.bottom-field .support-card-wrap .card-face')].map(card => card.classList.contains('is-rested')),
  hand: document.querySelectorAll('.bottom-hand .hand-card-wrap').length,
}))
const scenarios = ['positive-cookie', 'positive-item', 'low-cookie', 'low-item', 'negative', 'last-no-hand',
  'skip', 'low-skip', 'cancel', 'attack', 'attack-negative', 'wrong-color', 'wrong-phase', 'attack-cancel']
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport }), errors = [], row = { viewport, scenario, status: 'FAIL' }
    page.setDefaultTimeout(8000)
    page.on('pageerror', error => errors.push(error.message))
    try {
      const attackMode = scenario.startsWith('attack') || ['wrong-color', 'wrong-phase'].includes(scenario)
      const route = scenario.startsWith('positive-') || ['skip', 'cancel'].includes(scenario) ? 'positive'
        : scenario.startsWith('low-') ? 'low' : scenario === 'attack-cancel' ? 'attack' : scenario
      await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-005:${route}&contract-card=ST6-005`)
      await page.locator('.bottom-field').waitFor()
      await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
      const image = attackMode ? page.locator('.bottom-field img[alt="Agar Agar Cookie"]').first()
        : page.locator('.flip-response-modal img[alt="Agar Agar Cookie"]').first()
      await image.waitFor()
      await image.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = () => reject(new Error('Original art failed'))
      }))
      assert.match(await image.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
      row.before = await publicState(page)
      assert.ok(row.before.own.length <= 2 && row.before.foe.length <= 2)
      if (attackMode) {
        const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Agar Agar Cookie"]') })
        if (['attack-negative', 'wrong-color', 'wrong-phase'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        } else {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap .card-face').first().click()
          if (scenario === 'attack-cancel') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            await page.locator('.bottom-field .support-card-wrap .card-face').nth(1).click()
            row.paymentText = await page.getByTestId('attack-payment-panel').innerText()
            assert.match(row.paymentText, /已選 2／2/)
            await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim() === '1/3')
          }
        }
      } else {
        const flip = page.locator('.flip-response-modal')
        const confirm = flip.getByRole('button', { name: /確認發動|發動效果|發動 FLIP/ }).last()
        assert.equal(await confirm.isEnabled(), false)
        const options = flip.locator('.flip-card-page button')
        assert.equal(await options.count(), ['negative', 'last-no-hand'].includes(scenario) ? 0 : 2)
        if (['negative', 'last-no-hand', 'skip', 'low-skip', 'cancel'].includes(scenario)) {
          if (scenario === 'cancel') {
            await options.first().click(); assert.equal(await confirm.isEnabled(), true)
            await options.first().click(); assert.equal(await confirm.isEnabled(), false)
          }
          await flip.getByRole('button', { name: '不發動', exact: true }).click()
        } else {
          await options.nth(scenario.endsWith('-item') ? 1 : 0).click()
          assert.equal(await confirm.isEnabled(), true)
          await confirm.click()
        }
        await flip.waitFor({ state: 'hidden' })
        const activated = scenario.endsWith('-cookie') || scenario.endsWith('-item')
        if (activated) await page.waitForFunction(() => document.querySelector('.bottom-field img[alt="Leek Cookie"]')?.closest('.combat-card-wrap')?.querySelector('.badge-hp')?.textContent.trim() === '1/3')
        else await page.locator('.bottom-field .combat-card-wrap img[alt="Leek Cookie"]').waitFor({ state: 'hidden' })
      }
      row.after = await publicState(page)
      if (scenario === 'attack') {
        assert.deepEqual(row.after.foe, ['1/3'])
        assert.deepEqual(row.after.support, [true, true])
        assert.equal(row.after.own[0].rested, true)
      } else if (attackMode) assert.deepEqual(row.after, row.before)
      else {
        const activated = scenario.endsWith('-cookie') || scenario.endsWith('-item')
        assert.equal(row.after.hand, activated ? 1 : row.before.hand)
        assert.equal(row.after.own.length, activated ? 2 : 1)
        assert.deepEqual(row.after.support, [])
        assert.deepEqual(row.after.own.at(-1), row.before.own.at(-1))
        assert.deepEqual(row.after.foe, row.before.foe)
      }
      row.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
      if (!attackMode) assert.ok(row.trace.some(entry => entry.commandKind === 'resolve-flip'))
      if (scenario === 'attack') assert.ok(row.trace.some(entry => entry.commandKind === 'declare-attack'))
      if (attackMode && scenario !== 'attack') assert.deepEqual(row.trace, [])
      assert.deepEqual(errors, [])
      row.status = 'PASS'
    } catch (error) {
      row.error = String(error.stack ?? error); row.body = await page.locator('body').innerText(); throw error
    } finally {
      row.errors = errors; rows.push(row)
      await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-${row.status}.png`, fullPage: true })
      await page.close()
    }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2))
  await browser?.close(); server.kill()
}
console.log(`PASS ${rows.length} ST6-005 original-printing UI cases`)
