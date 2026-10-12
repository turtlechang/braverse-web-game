import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = process.env.BRAVERSE_ST6009_OUTPUT ?? 'output/st6-st10/st6-009-browser-candidate'
await mkdir(output, { recursive: true })
const port = 4225
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
let browser
const rows = []
const snapshot = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return {
      trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(cookie => ({
        id: cookie.getAttribute('data-card-instance-id'), hp: cookie.querySelector('.badge-hp').textContent.trim(),
        rested: cookie.querySelector('.card-face').classList.contains('is-rested'),
      })),
      support: [...field.querySelectorAll('.support-card-wrap .card-face')].map(card => card.classList.contains('is-rested')),
    }
  }
  return { own: side('bottom'), foe: side('top'), hand: document.querySelectorAll('.bottom-hand .hand-card-wrap').length }
})
const scenarios = ['positive', 'zero', 'low', 'cost-cookie', 'cost-item', 'rested-source', 'cancel-cost',
  'cancel-selected', 'negative', 'wrong-phase', 'wrong-color', 'no-energy', 'used', 'attack', 'attack-negative', 'attack-cancel']
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
      const route = scenario.startsWith('cancel') ? 'positive' : scenario === 'attack-cancel' ? 'attack' : scenario
      await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-009:${route}&contract-card=ST6-009`)
      await page.locator('.bottom-field').waitFor()
      await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
      const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Capsaicin Cookie"]') })
      const art = source.locator('img').first()
      await art.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = () => reject(new Error('Original art unavailable'))
      }))
      assert.match(await art.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
      row.before = await snapshot(page)
      assert.equal(row.before.own.battle[0].hp, '5/5')
      if (scenario.startsWith('attack')) {
        if (scenario === 'attack-negative') assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        else {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap .card-face').first().click()
          if (scenario === 'attack-cancel') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            for (const index of [1, 2, 3]) await page.locator('.bottom-field .support-card-wrap .card-face').nth(index).click()
            assert.match(await page.getByTestId('attack-payment-panel').innerText(), /已選 4／4/)
            await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first().click()
            await page.locator('.top-field .combat-card-wrap img[alt="Sour Belt Cookie"]').waitFor({ state: 'hidden' })
          }
        }
      } else if (['negative', 'wrong-phase', 'wrong-color', 'no-energy', 'used'].includes(scenario)) {
        assert.equal(await source.locator('.skill-action').isEnabled(), false)
      } else {
        await source.locator('.skill-action').click()
        const panel = page.locator('.effect-panel')
        if (scenario === 'cancel-cost') await panel.locator('.skip-effect').click()
        else {
          const payment = panel.locator('.effect-candidates-payment button')
          assert.equal(await payment.count(), scenario === 'rested-source' ? 1 : scenario === 'low' ? 2 : 5)
          if (!(await payment.first().getAttribute('class')).includes('is-selected')) await payment.first().click()
          await panel.locator('.effect-panel-primary-action').click()
          const discard = panel.locator('.effect-candidates-discard-hand button')
          assert.equal(await discard.count(), 1)
          if (!(await discard.first().getAttribute('class')).includes('is-selected')) await discard.first().click()
          if (scenario === 'cancel-selected') await panel.locator('.skip-effect').click()
          else {
            await panel.locator('.effect-panel-primary-action').click()
            const targets = panel.locator('.effect-candidates-target button')
            assert.equal(await targets.count(), scenario === 'rested-source' ? 1 : 2)
            assert.match(await targets.first().innerText(), /Sour Belt Cookie/)
            if (scenario === 'zero') {
              for (const target of await targets.all()) if ((await target.getAttribute('class')).includes('is-selected')) await target.click()
            } else if (!(await targets.first().getAttribute('class')).includes('is-selected')) await targets.first().click()
            await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-selection.png`, fullPage: true })
            await panel.locator('.effect-panel-primary-action').click()
          }
        }
        await panel.waitFor({ state: 'hidden' })
        if (scenario === 'low') await page.locator('.top-field .combat-card-wrap img[alt="Sour Belt Cookie"]').waitFor({ state: 'hidden' })
      }
      row.after = await snapshot(page)
      const usedSkill = ['positive', 'zero', 'low', 'cost-cookie', 'cost-item', 'rested-source'].includes(scenario)
      if (usedSkill) {
        assert.equal(row.after.hand, row.before.hand - 1)
        assert.equal(row.after.own.trash, row.before.own.trash + 1)
        assert.equal(row.after.own.support.filter(Boolean).length, row.before.own.support.filter(Boolean).length + 1)
        assert.deepEqual(row.after.own.battle, row.before.own.battle)
        if (scenario === 'zero') assert.deepEqual(row.after.foe, row.before.foe)
        else if (scenario === 'low') assert.deepEqual(row.after.foe.battle.map(c => c.hp), ['3/3'])
        else {
          assert.equal(row.after.foe.battle[0].hp, '3/4')
          assert.deepEqual(row.after.foe.battle.slice(1), row.before.foe.battle.slice(1))
        }
      } else if (scenario === 'attack') {
        assert.deepEqual(row.after.own.support, [true, true, true, true, false])
        assert.equal(row.after.own.battle[0].rested, true)
        assert.equal(row.after.own.battle[0].hp, '5/5')
        assert.equal(row.after.hand, row.before.hand)
        assert.deepEqual(row.after.foe.battle.map(c => c.hp), ['3/3'])
      } else assert.deepEqual(row.after, row.before)
      row.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
      if (usedSkill) assert.ok(row.trace.some(entry => entry.commandKind === 'begin-activate-skill'))
      if (scenario === 'attack') assert.ok(row.trace.some(entry => entry.commandKind === 'declare-attack'))
      assert.deepEqual(errors, [])
      row.status = 'PASS'
    } catch (error) { row.error = String(error.stack ?? error); row.body = await page.locator('body').innerText(); throw error }
    finally { rows.push(row); await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-${row.status}.png`, fullPage: true }); await page.close() }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2))
  await browser?.close(); server.kill()
}
console.log(`PASS ${rows.length} ST6-009 original-printing UI cases`)
