import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output = process.env.BRAVERSE_ST6010_OUTPUT ?? 'output/st6-st10/st6-010-browser-candidate'
await mkdir(output, { recursive: true })
const port = 4226
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
let browser
const rows = []
const snapshot = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    return {
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(c => ({
        id: c.getAttribute('data-card-instance-id'), hp: c.querySelector('.badge-hp').textContent.trim(),
        rested: c.querySelector('.card-face').classList.contains('is-rested'),
      })),
      support: [...field.querySelectorAll('.support-card-wrap')].map(c => ({
        id: c.getAttribute('data-card-instance-id'), rested: c.querySelector('.card-face').classList.contains('is-rested'),
      })),
      trash: Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
    }
  }
  return { own: side('bottom'), foe: side('top'), hand: document.querySelectorAll('.bottom-hand .hand-card-wrap').length }
})
const trace = page => page.evaluate(() => window.__braverseContractTrace ?? [])
const waitHp = (page, expected) => page.waitForFunction(hp =>
  [...document.querySelectorAll('.bottom-field .combat-card-wrap .badge-hp')].map(c => c.textContent.trim()).join(',') === hp.join(','), expected)
const scenarios = ['positive', 'low', 'rested-source', 'second-attack', 'payment-toggle', 'back', 'back-selected', 'skip',
  'negative', 'wrong-color', 'already-target', 'no-battle', 'wrong-phase', 'attack', 'attack-cancel', 'attack-negative', 'attack-wrong-color']
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]) for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport }), errors = [], row = { viewport, scenario, status: 'FAIL' }
    page.setDefaultTimeout(8000)
    page.on('pageerror', error => errors.push(error.message))
    try {
      const route = ['payment-toggle', 'back', 'back-selected', 'skip'].includes(scenario) ? 'positive' : scenario === 'attack-cancel' ? 'attack' : scenario
      await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-010:${route}&contract-card=ST6-010`)
      await page.locator('.bottom-field').waitFor()
      await page.getByLabel('動畫速度', { exact: true }).selectOption('reduced')
      const source = page.locator('.bottom-field .combat-card-wrap').filter({ has: page.locator('img[alt="Peperoncino Cookie"]') })
      const image = source.locator('img').first()
      await image.evaluate(img => img.complete && img.naturalWidth > 0 ? Promise.resolve() : new Promise((resolve, reject) => {
        img.onload = resolve; img.onerror = () => reject(new Error('Original printing failed to load'))
      }))
      assert.match(await image.getAttribute('src'), /cookierunbraverse.com\/data\/en_storage\//)
      row.before = await snapshot(page); row.beforeTrace = await trace(page)
      const blocked = ['negative', 'wrong-color', 'already-target', 'no-battle', 'wrong-phase'].includes(scenario)
      if (scenario.startsWith('attack')) {
        if (['attack-negative', 'attack-wrong-color'].includes(scenario)) assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        else {
          await source.locator('.card-face.is-attackable').click()
          await page.locator('.bottom-field .support-card-wrap .card-face').first().click()
          if (scenario === 'attack-cancel') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            await page.locator('.bottom-field .support-card-wrap .card-face').nth(2).click()
            assert.match(await page.getByTestId('attack-payment-panel').innerText(), /已選 2／2/)
            await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first().click()
            await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim() === '2/3')
          }
        }
      } else if (blocked) {
        assert.equal(await page.locator('.blocker-response-modal:visible').count(), 0)
        assert.equal(await page.locator('.attack-response-modal .modal-card-options button').filter({ hasText: 'Peperoncino Cookie' }).count(), 0)
        if (['negative', 'wrong-color'].includes(scenario)) await waitHp(page, ['3/3', '1/2'])
        if (scenario === 'already-target') await waitHp(page, ['2/3', '2/2'])
      } else {
        const chooser = page.locator('.attack-response-modal:visible')
        await chooser.locator('.modal-card-options button').filter({ hasText: 'Peperoncino Cookie' }).click()
        const modal = page.locator('.blocker-response-modal:visible')
        await modal.waitFor()
        assert.equal(await modal.locator('.blocker-candidates button').count(), 1)
        if (!await modal.locator('.blocker-candidates button.is-selected').count()) await modal.locator('.blocker-candidates button').click()
        assert.equal(await modal.locator('.blocker-source-cost').count(), 0)
        const confirm = modal.getByRole('button', { name: '使用 Blocker', exact: true })
        assert.equal(await confirm.isEnabled(), false)
        const payments = modal.locator('.blocker-payment-candidates button')
        assert.equal(await payments.count(), ['rested-source', 'second-attack'].includes(scenario) ? 1 : 2)
        assert.equal(await payments.locator('img[alt="Winding Key Shield"]').count(), 0)
        if (scenario === 'back') await modal.getByRole('button', { name: '返回', exact: true }).click()
        else if (scenario === 'skip') {
          await modal.getByRole('button', { name: '不使用', exact: true }).click()
          await waitHp(page, ['3/3', '1/2'])
        } else {
          await payments.first().click()
          assert.equal(await confirm.isEnabled(), true)
          if (scenario === 'payment-toggle') {
            await payments.first().click()
            assert.equal(await confirm.isEnabled(), false)
            await payments.first().click()
            assert.equal(await confirm.isEnabled(), true)
          }
          await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-payment.png`, fullPage: true })
          if (scenario === 'back-selected') await modal.getByRole('button', { name: '返回', exact: true }).click()
          else {
            await confirm.click()
            await waitHp(page, [scenario === 'second-attack' ? '1/3' : '2/3', row.before.own.battle[1].hp])
          }
        }
      }
      row.after = await snapshot(page); row.trace = await trace(page)
      const used = ['positive', 'low', 'rested-source', 'second-attack', 'payment-toggle'].includes(scenario)
      const beforeBlocks = row.beforeTrace.filter(e => e.commandKind === 'play-blocker').length
      assert.equal(row.trace.filter(e => e.commandKind === 'play-blocker').length - beforeBlocks, used ? 1 : 0)
      if (used) {
        assert.equal(row.after.own.battle[0].rested, row.before.own.battle[0].rested)
        assert.deepEqual(row.after.own.battle[1], row.before.own.battle[1])
        assert.equal(row.after.own.support.filter(s => s.rested).length, row.before.own.support.filter(s => s.rested).length + 1)
        assert.equal(row.after.hand, row.before.hand)
        await page.getByTestId('battle-log-toggle').click()
        const downloadEvent = page.waitForEvent('download')
        await page.getByTestId('battle-log-export-replay').click()
        const download = await downloadEvent, path = `${output}/${scenario}-${viewport.width}-replay.json`
        await download.saveAs(path)
        const replay = JSON.parse(await readFile(path, 'utf8'))
        const block = replay.commands.filter(command => command.kind === 'play-blocker').at(-1)
        assert.equal(block.sourceInstanceId, row.before.own.battle[0].id)
        assert.equal(block.paymentIds.length, 1)
        assert.equal(block.discardHandIds?.length ?? 0, 0)
        assert.ok(replay.commands.some(command => command.kind === 'resolve-battle'))
      } else if (['back', 'back-selected', 'no-battle', 'wrong-phase', 'attack-cancel', 'attack-negative', 'attack-wrong-color'].includes(scenario)) assert.deepEqual(row.after, row.before)
      assert.deepEqual(errors, [])
      row.status = 'PASS'
    } catch (error) { row.error = String(error.stack ?? error); row.body = await page.locator('body').innerText(); throw error }
    finally { rows.push(row); await page.screenshot({ path: `${output}/${scenario}-${viewport.width}-${row.status}.png`, fullPage: true }); await page.close() }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(rows, null, 2))
  await browser?.close(); server.kill()
}
console.log(`PASS ${rows.length} ST6-010 original-printing UI cases`)
