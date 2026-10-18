import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = process.env.BRAVERSE_ST6003_OUTPUT ?? 'output/st6-st10/st6-003-browser-candidate'
await mkdir(output, { recursive: true })
const port = 4215
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
const rows = []
let browser
const publicState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return {
      trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(c => ({
        id: c.getAttribute('data-card-instance-id'), hp: Number(c.querySelector('.badge-hp')?.textContent.trim().split('/')[0]),
        printedHp: Number(c.querySelector('.badge-hp')?.textContent.trim().split('/')[1]),
        rested: c.querySelector('.card-face').classList.contains('is-rested'),
      })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(c => ({
        id: c.getAttribute('data-card-instance-id'), rested: c.querySelector('.card-face').classList.contains('is-rested'),
      })),
    }
  }
  return { own: side('bottom'), foe: side('top') }
})
try {
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100))
  }
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]) {
    for (const scenario of ['positive', 'cancel', 'negative', 'wrong-phase', 'used']) {
      const page = await browser.newPage({ viewport }), errors = []
      const row = { viewport, scenario, status: 'FAIL' }
      page.on('pageerror', e => errors.push(e.message))
      try {
        await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-003:${scenario === 'cancel' ? 'positive' : scenario}&contract-card=ST6-003`)
        await page.locator('.bottom-field').waitFor()
        await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
        const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Devil Cookie"]') })
        const art = source.locator('img').first()
        await art.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => {
          img.onload = resolve; img.onerror = () => reject(new Error('Original art failed'))
        }))
        assert.match(await art.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
        row.before = await publicState(page)
        assert.equal(row.before.own.battle[0].hp, 4)
        assert.equal(row.before.own.battle[0].printedHp, 4)
        assert.equal(await source.locator('.skill-action').count(), 0)
        if (['negative', 'wrong-phase', 'used'].includes(scenario)) {
          assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          if (scenario === 'negative') assert.equal(row.before.own.support.filter(s => !s.rested).length, 2)
          if (scenario === 'wrong-phase') assert.equal(row.before.own.support.filter(s => !s.rested).length, 6)
          if (scenario === 'used') {
            assert.equal(row.before.own.battle[0].rested, true)
            assert.equal(row.before.own.support.filter(s => !s.rested).length, 3)
            assert.equal(row.before.foe.battle[0].hp, 1)
          }
        } else {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap .card-face').nth(0).click()
          if (scenario === 'cancel') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            for (const index of [1, 2]) await page.locator('.bottom-field .support-card-wrap .card-face').nth(index).click()
            const payment = page.getByTestId('attack-payment-panel')
            assert.match(await payment.innerText(), /已選 3／3/)
            row.paymentText = await payment.innerText()
            await page.screenshot({ path: `${output}/payment-${viewport.width}.png`, fullPage: true })
            const targets = page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]')
            assert.equal(await targets.count(), 2)
            await targets.first().click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim().split('/')[0] === '1')
            await payment.waitFor({ state: 'hidden' })
          }
        }
        row.after = await publicState(page)
        if (scenario === 'positive') {
          assert.deepEqual(row.after.own.support.map(s => s.rested), [true, true, true, false, false, false])
          assert.equal(row.after.own.battle[0].rested, true)
          assert.equal(row.after.own.battle[0].hp, 4)
          assert.deepEqual(row.after.foe.battle.map(c => c.hp), [1, 3])
          assert.equal(row.after.foe.trash - row.before.foe.trash, 3)
          assert.equal(row.after.own.trash, row.before.own.trash)
        } else assert.deepEqual(row.after, row.before)
        row.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
        if (scenario === 'positive') assert.ok(row.trace.some(e => e.commandKind === 'declare-attack'))
        if (scenario === 'cancel') assert.deepEqual(row.trace, [])
        assert.ok(!row.trace.some(e => ['activate-skill', 'resolve-attack-effect', 'resolve-flip'].includes(e.commandKind)))
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
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2))
  await browser?.close(); server.kill()
}
console.log(`PASS ${rows.length} ST6-003 original-printing UI cases`)
