import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const attackMode = process.argv.includes('--attack')
const formalMode = process.argv.includes('--formal')
const output = `output/st6-st10/st6-002-browser-${attackMode ? 'attack' : 'skill'}${formalMode ? '-formal' : ''}-legal-zones-v2`
await mkdir(output, { recursive: true })
const port = 4214
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
let browser
const rows = []
const publicState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return {
      trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(c => ({
        id: c.getAttribute('data-card-instance-id'), hp: c.querySelector('.badge-hp')?.textContent.trim(),
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
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]) {
    for (const scenario of (attackMode ? ['attack-pay', 'attack-skip', 'attack-cancel', 'attack-negative', 'low', 'attack-target-faints'] : ['positive', 'zero', 'cancel', 'negative', 'wrong-color', 'wrong-phase', 'used'])) {
      const page = await browser.newPage({ viewport }), errors = []
      page.setDefaultTimeout(8000)
      const row = { viewport, scenario, status: 'FAIL' }
      page.on('pageerror', error => errors.push(error.message))
      try {
        const route = scenario === 'attack-target-faints' ? 'target-faints' : attackMode && scenario !== 'low' && scenario !== 'attack-negative' ? 'attack' : scenario === 'cancel' ? 'positive' : scenario
        await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-002:${route}&contract-card=ST6-002`)
        await page.locator('.bottom-field').waitFor()
        await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
        const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Fire Spirit Cookie"]') })
        const art = source.locator('img').first()
        await art.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => {
          img.onload = resolve; img.onerror = () => reject(new Error('Original art failed'))
        }))
        assert.match(await art.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
        row.before = await publicState(page)
        assert.ok(row.before.own.battle.length <= 2 && row.before.foe.battle.length <= 2)
        const skill = source.locator('.skill-action')
        if (attackMode) {
          if (scenario === 'attack-negative') assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
          else {
            await source.locator('.card-face.is-attackable').click()
            for (let i = 0; i < 2; i++) await page.locator('.bottom-field .support-card-wrap .card-face').nth(i).click()
            await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').nth(scenario === 'attack-target-faints' ? 1 : 0).click()
            if (scenario === 'attack-target-faints') {
              await page.waitForFunction(() => document.querySelectorAll('.top-field .combat-card-wrap').length === 1 && !document.querySelector('.effect-panel, .optional-cost-attack-modal'))
            } else {
            const optional = page.locator('.optional-cost-attack-inline:visible, .optional-cost-attack-modal:visible')
            await optional.waitFor()
            if (scenario === 'attack-skip') await optional.getByRole('button', { name: '略過', exact: true }).click()
            else {
              await optional.getByRole('button', { name: '支付', exact: true }).click()
              const candidates = optional.locator('.optional-cost-col .modal-card-options button')
              assert.equal(await candidates.count(), 1)
              assert.match(await candidates.innerText(), /Fire Spirit Cookie/)
              await candidates.click()
              if (scenario === 'attack-cancel') {
                await optional.getByRole('button', { name: '返回', exact: true }).click()
                await optional.getByRole('button', { name: '略過', exact: true }).click()
              } else {
                // Printed Then is bound to the original defender; no new target selector.
                assert.equal(await optional.getByRole('button', { name: '下一步', exact: true }).count(), 0)
                await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-selection.png`, fullPage: true })
                await optional.getByRole('button', { name: '確認', exact: true }).click()
              }
            }
            await optional.waitFor({ state: 'hidden' })
            const expectedHp = ['attack-skip', 'attack-cancel'].includes(scenario) ? '3/4' : '1/4'
            await page.waitForFunction(expected => document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim() === expected, expectedHp)
            if (scenario === 'low') {
              // Last-HP cost fainting legitimately opens replacement. Finish that parent flow.
              const decline = page.getByRole('button', { name: '不補餅乾', exact: true })
              await decline.click()
              await decline.waitFor({ state: 'hidden' })
              row.replacement = 'declined through visible UI; replacement modal closed'
              assert.equal(await page.getByRole('button', { name: '結束主要階段', exact: true }).isEnabled(), true)
            }
            }
          }
        } else if (['negative', 'wrong-color', 'wrong-phase', 'used'].includes(scenario)) {
          assert.equal(await skill.isEnabled(), false)
        } else {
          await skill.click()
          const panel = page.locator('.effect-panel')
          assert.equal(await panel.locator('.effect-candidates-payment button').count(), 3)
          await panel.locator('.effect-candidates-payment button').first().click()
          await panel.locator('.effect-panel-primary-action').click()
          assert.equal(await panel.locator('.effect-candidates-hp-cost button').count(), 0)
          const targets = panel.locator('.effect-candidates-target button')
          assert.deepEqual(await targets.locator('span').allTextContents(), ['Sour Belt Cookie', 'Leek Cookie'])
          if (scenario === 'cancel') await panel.locator('.skip-effect').click()
          else {
            if (scenario === 'positive') await targets.filter({ hasText: 'Sour Belt Cookie' }).click()
            await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-selection.png`, fullPage: true })
            await panel.locator('.effect-panel-primary-action').click()
          }
          await panel.waitFor({ state: 'hidden' })
        }
        row.after = await publicState(page)
        assert.ok(row.after.own.battle.length <= 2 && row.after.foe.battle.length <= 2)
        if (attackMode && scenario !== 'attack-negative') {
          const paid = ['attack-pay', 'low'].includes(scenario)
          const remaining = row.after.own.battle.find(c => c.id.includes('ST6-002'))
          if (scenario === 'low') assert.equal(remaining, undefined)
          else { assert.equal(remaining.hp, paid ? '5/6' : '6/6'); assert.equal(remaining.rested, true) }
          assert.equal(row.after.own.trash, row.before.own.trash + (paid ? 1 : 0))
          assert.deepEqual(row.after.own.support.map(s => s.rested), [true, true, false])
          if (scenario === 'attack-target-faints') assert.deepEqual(row.after.foe.battle, row.before.foe.battle.slice(0, 1))
          else assert.deepEqual(row.after.foe.battle.slice(1), row.before.foe.battle.slice(1))
          assert.deepEqual(row.after.own.battle.filter(c => !c.id.includes('ST6-002')), row.before.own.battle.filter(c => !c.id.includes('ST6-002')))
        } else if (['positive', 'zero'].includes(scenario)) {
          assert.deepEqual(row.after.own.battle, row.before.own.battle)
          assert.equal(row.after.own.trash, row.before.own.trash)
          assert.deepEqual(row.after.own.support.map(s => s.rested), [true, false, false])
          assert.equal(row.after.foe.battle[0].hp, scenario === 'positive' ? '3/4' : '4/4')
          assert.deepEqual(row.after.foe.battle.slice(1), row.before.foe.battle.slice(1))
        } else assert.deepEqual(row.after, row.before)
        row.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
        if (attackMode && scenario !== 'attack-negative') {
          assert.ok(row.trace.some(e => e.commandKind === 'declare-attack'))
          if (scenario === 'attack-target-faints') assert.ok(!row.trace.some(e => e.commandKind === 'resolve-optional-cost-attack'))
          else assert.ok(row.trace.some(e => e.commandKind === 'resolve-optional-cost-attack'))
          // Contract trace is filtered by source card; source-less skip-replacement is
          // verified by the visible UI above and the rule-level physical fixture test.
        }
        if (['positive', 'zero'].includes(scenario)) assert.ok(row.trace.some(e => ['activate-skill', 'begin-activate-skill'].includes(e.commandKind)))
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
console.log(`PASS ${rows.length} ST6-002 ${attackMode ? 'attack Then' : 'skill'} UI cases`)
