import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = 'output/st6-st10/st6-001-browser'
await mkdir(output, { recursive: true })
const port = 4213
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
const rows = []
let browser
const publicState = page => page.evaluate(() => {
  const side = name => {
    const f = document.querySelector(`.${name}-field`)
    return {
      trash: Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      battle: [...f.querySelectorAll('.combat-card-wrap')].map(c => ({ id: c.getAttribute('data-card-instance-id'), hp: c.querySelector('.badge-hp')?.textContent.trim(), rested: c.querySelector('.card-face').classList.contains('is-rested') })),
      support: [...f.querySelectorAll('.support-card-wrap')].map(c => ({ id: c.getAttribute('data-card-instance-id'), rested: c.querySelector('.card-face').classList.contains('is-rested') })),
    }
  }
  return { own: side('bottom'), foe: side('top') }
})
try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break } catch { /* starting */ } await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]) {
    for (const scenario of ['positive', 'negative', 'low', 'zero', 'cancel', 'attack', 'attack-negative']) {
      const page = await browser.newPage({ viewport }), errors = []
      const row = { viewport, scenario, status: 'FAIL' }
      page.on('pageerror', e => errors.push(e.message))
      try {
        await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-001:${scenario === 'cancel' ? 'positive' : scenario}&contract-card=ST6-001`)
        await page.locator('.bottom-field').waitFor()
        await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
        const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Mala Sauce Cookie"]') })
        const art = source.locator('img').first()
        await art.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Original art failed')) }))
        assert.match(await art.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
        row.before = await publicState(page)
        const skill = source.locator('.skill-action')
        if (scenario.startsWith('attack')) {
          if (scenario === 'attack-negative') assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          else {
            await source.locator('.card-face.is-attackable').click()
            await page.locator('.bottom-field .support-card-wrap .card-face').click()
            await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first().click()
            await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(e => e.commandKind === 'resolve-battle'))
          }
        }
        else if (scenario === 'negative') assert.equal(await skill.isEnabled(), false)
        else {
          await skill.click()
          const panel = page.locator('.effect-panel')
          await panel.locator('.effect-candidates-payment button').click()
          await panel.locator('.effect-panel-primary-action').click()
          const hp = panel.locator('.effect-candidates-hp-cost button')
          assert.equal(await hp.count(), 1)
          assert.match(await hp.innerText(), /Mala Sauce Cookie/)
          await hp.click()
          if (scenario === 'cancel') await panel.locator('.skip-effect').click()
          else {
            await panel.locator('.effect-panel-primary-action').click()
            const targets = panel.locator('.effect-candidates-target button')
            assert.deepEqual(await targets.locator('span').allTextContents(), ['Sour Belt Cookie', 'Leek Cookie'])
            if (scenario !== 'zero') await targets.filter({ hasText: 'Sour Belt Cookie' }).click()
            await panel.locator('.effect-panel-primary-action').click()
          }
          await panel.waitFor({ state: 'hidden' })
        }
        row.after = await publicState(page)
        const normal = scenario.startsWith('attack')
        const paid = !['negative', 'cancel', 'attack-negative'].includes(scenario)
        assert.equal(row.after.own.support[0].rested, paid || ['negative', 'attack-negative'].includes(scenario))
        if (!paid) assert.deepEqual(row.after, row.before)
        else {
          assert.equal(row.after.own.trash, row.before.own.trash + (normal ? 0 : 1))
          assert.deepEqual(row.after.own.battle.filter(c => !c.id.includes('ST6-001')), row.before.own.battle.filter(c => !c.id.includes('ST6-001')))
          const remaining = row.after.own.battle.find(c => c.id.includes('ST6-001'))
          if (scenario === 'low') assert.equal(remaining, undefined)
          else { assert.equal(remaining.hp, normal ? '2/2' : '1/2'); assert.equal(remaining.rested, normal) }
          assert.equal(row.after.foe.battle[0].hp, scenario === 'zero' ? '4/4' : '3/4')
          assert.deepEqual(row.after.foe.battle[1], row.before.foe.battle[1])
        }
        row.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
        if (paid) assert.ok(row.trace.some(e => (normal ? ['declare-attack'] : ['activate-skill', 'begin-activate-skill']).includes(e.commandKind)))
        assert.deepEqual(errors, [])
        row.status = 'PASS'
      } catch (e) { row.error = String(e.stack ?? e); row.body = await page.locator('body').innerText(); throw e }
      finally { row.errors = errors; rows.push(row); await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-${row.status}.png`, fullPage: true }); await page.close() }
    }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2))
  await browser?.close(); server.kill()
}
console.log(`PASS ${rows.length} ST6-001 physical UI cases`)
