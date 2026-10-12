import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = process.env.BRAVERSE_ST6004_OUTPUT ?? 'output/st6-st10/st6-004-browser-candidate'
await mkdir(output, { recursive: true })
const port = 4216
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port)], { stdio: 'ignore' })
const rows = []
let browser
const publicState = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return {
      trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(cookie => ({
        id: cookie.getAttribute('data-card-instance-id'), hp: cookie.querySelector('.badge-hp')?.textContent.trim(),
        attack: Number(cookie.querySelector('.badge-atk')?.textContent.trim()),
        rested: cookie.querySelector('.card-face').classList.contains('is-rested'),
      })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(s => ({
        id: s.getAttribute('data-card-instance-id'), rested: s.querySelector('.card-face').classList.contains('is-rested'),
      })),
    }
  }
  return { own: side('bottom'), foe: side('top'), hand: document.querySelectorAll('.bottom-hand .hand-card-wrap').length }
})
const scenarios = ['positive', 'skill-cookie', 'no-energy', 'rested-source', 'cancel', 'negative', 'wrong-phase', 'used',
  'attack-pay', 'attack-zero', 'attack-skip', 'attack-cancel', 'no-extra-energy', 'attack-wrong-color', 'attack-negative', 'wrong-color', 'target-faints']
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
      const attackMode = scenario.startsWith('attack-') || ['no-extra-energy', 'wrong-color', 'target-faints'].includes(scenario)
      const route = ['skill-cookie', 'cancel'].includes(scenario) ? 'positive' : ['attack-pay', 'attack-zero', 'attack-skip', 'attack-cancel'].includes(scenario) ? 'attack' : scenario
      await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-004:${route}&contract-card=ST6-004`)
      await page.locator('.bottom-field').waitFor()
      await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
      const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Pitaya Dragon Cookie"]') })
      const art = source.locator('img').first()
      await art.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = () => reject(new Error('Original art failed'))
      }))
      assert.match(await art.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
      row.before = await publicState(page)
      assert.equal(row.before.hand, scenario === 'negative' ? 0 : scenario === 'used' ? 1 : 2)
      assert.ok(row.before.own.battle.length <= 2 && row.before.foe.battle.length <= 2)
      if (attackMode) {
        if (['attack-negative', 'wrong-color'].includes(scenario)) assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        else {
          await source.locator('.card-face.is-attackable').click()
          for (let i = 0; i < 3; i++) await page.locator('.bottom-field .support-card-wrap .card-face').nth(i).click()
          await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').nth(scenario === 'target-faints' ? 1 : 0).click()
          const optional = page.locator('.optional-cost-attack-inline:visible, .optional-cost-attack-modal:visible')
          await optional.waitFor()
          if (['no-extra-energy', 'attack-wrong-color'].includes(scenario)) {
            assert.equal(await optional.getByRole('button', { name: '支付', exact: true }).isEnabled(), false)
            await optional.getByRole('button', { name: '略過', exact: true }).click()
          } else if (scenario === 'attack-skip') await optional.getByRole('button', { name: '略過', exact: true }).click()
          else {
            await optional.getByRole('button', { name: '支付', exact: true }).click()
            assert.equal(await optional.locator('.optional-source-energy-options').count(), 0)
            const energy = optional.locator('.optional-cost-col .modal-card-options button')
            assert.equal(await energy.count(), 1)
            assert.match(await energy.innerText(), /Overhydrated Dough Swamp/)
            await energy.click()
            if (scenario === 'attack-cancel') {
              await optional.getByRole('button', { name: '返回', exact: true }).click()
              await optional.getByRole('button', { name: '略過', exact: true }).click()
            } else {
              await optional.getByRole('button', { name: '下一步', exact: true }).click()
              const targets = optional.locator('.optional-cost-col .modal-card-options button')
              assert.deepEqual(await targets.locator('span').allTextContents(), scenario === 'target-faints' ? ['Sour Belt Cookie'] : ['Sour Belt Cookie', 'Leek Cookie'])
              if (scenario !== 'attack-zero') await targets.filter({ hasText: scenario === 'target-faints' ? 'Sour Belt Cookie' : 'Leek Cookie' }).click()
              await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-selection.png`, fullPage: true })
              await optional.getByRole('button', { name: '確認', exact: true }).click()
            }
          }
          await optional.waitFor({ state: 'hidden' })
        }
      } else if (['negative', 'wrong-phase', 'used'].includes(scenario)) {
        assert.equal(await source.locator('.skill-action').isEnabled(), false)
      } else {
        await source.locator('.skill-action').click()
        const panel = page.locator('.effect-panel')
        assert.equal(await panel.locator('.effect-candidates-payment button').count(), 0)
        const discard = panel.locator('.effect-candidates-discard-hand button')
        assert.equal(await discard.count(), 2)
        await discard.nth(scenario === 'skill-cookie' ? 1 : 0).click()
        if (scenario === 'cancel') await panel.locator('.skip-effect').click()
        else {
          await panel.locator('.effect-panel-primary-action').click()
          const target = panel.locator('.effect-candidates-target button')
          assert.equal(await target.count(), 1)
          assert.match(await target.innerText(), /Pitaya Dragon Cookie/)
          if (!(await target.getAttribute('class')).includes('is-selected')) await target.click()
          await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-selection.png`, fullPage: true })
          await panel.locator('.effect-panel-primary-action').click()
        }
        await panel.waitFor({ state: 'hidden' })
      }
      row.after = await publicState(page)
      assert.ok(row.after.own.battle.length <= 2 && row.after.foe.battle.length <= 2)
      if (attackMode && !['attack-negative', 'wrong-color'].includes(scenario)) {
        const paid = ['attack-pay', 'attack-zero', 'target-faints'].includes(scenario)
        assert.deepEqual(row.after.own.support.map(s => s.rested), [true, true, true, paid || scenario === 'no-extra-energy'])
        assert.equal(row.after.own.battle[0].hp, '4/4')
        assert.equal(row.after.own.battle[0].rested, true)
        assert.deepEqual(row.after.foe.battle.map(c => c.hp), scenario === 'target-faints' ? ['3/4'] : scenario === 'attack-pay' ? ['1/4', '2/3'] : ['1/4', '3/3'])
        assert.equal(row.after.own.trash, row.before.own.trash)
      } else if (['positive', 'skill-cookie', 'no-energy', 'rested-source'].includes(scenario)) {
        assert.equal(row.after.own.battle[0].attack, 4)
        assert.equal(row.after.own.battle[0].rested, row.before.own.battle[0].rested)
        assert.equal(row.after.own.battle[0].hp, '4/4')
        assert.deepEqual(row.after.own.battle.slice(1), row.before.own.battle.slice(1))
        assert.deepEqual(row.after.own.support, row.before.own.support)
        assert.deepEqual(row.after.foe, row.before.foe)
        assert.equal(row.after.own.trash, row.before.own.trash + 1)
        assert.equal(row.after.hand, row.before.hand - 1)
      } else assert.deepEqual(row.after, row.before)
      row.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
      if (attackMode && !['attack-negative', 'wrong-color'].includes(scenario)) {
        assert.ok(row.trace.some(entry => entry.commandKind === 'declare-attack'))
        assert.ok(row.trace.some(entry => entry.commandKind === 'resolve-optional-cost-attack'))
      }
      if (['positive', 'skill-cookie', 'no-energy', 'rested-source'].includes(scenario)) assert.ok(row.trace.some(entry => ['activate-skill', 'begin-activate-skill'].includes(entry.commandKind)))
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
console.log(`PASS ${rows.length} ST6-004 original-printing UI cases`)
