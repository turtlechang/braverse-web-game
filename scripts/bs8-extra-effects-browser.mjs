import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = []
const attackOnly = process.argv.includes('--attack-only')
const runAttacks = attackOnly || process.argv.includes('--attacks')
await mkdir('test-results/bs8-extra-effects', { recursive: true })
const snapshot = async page => ({
  hand: Number(await page.locator('.bottom-field .row-stat-value').last().innerText()),
  support: await page.locator('.bottom-field .support-card-wrap').count(),
  activeSupport: await page.locator('.bottom-field .support-card-wrap .card-face:not(.is-rested)').count(),
  battle: await page.locator('.bottom-field .combat-card-wrap').count(),
  trash: Number((await page.locator('.bottom-field .discard-zone').getAttribute('title')).match(/(\d+) 張/)[1]),
})
try {
  for (const viewport of attackOnly ? [] : [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const card of ['BS8-069', 'BS8-090', 'BS8-104']) {
      for (const choice of ['take', 'zero', 'skip', 'blocked']) {
        const page = await browser.newPage({ viewport })
        const label = `${viewport.width}-${card}-${choice}`
        page.setDefaultTimeout(7000)
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        try {
          await page.goto(`${baseUrl}?test-state=bs8-extra-deck:${card}:${choice === 'blocked' ? 'unmet' : 'met'}&contract-card=${card}`)
          const extra = page.getByLabel('玩家 EXTRA Deck 1 張')
          await extra.waitFor()
          if (choice === 'blocked') assert.equal(await extra.getAttribute('data-extra-deck-ready'), 'false')
          await extra.click()
          const play = page.getByRole('button', { name: '從 EXTRA 登場', exact: true })
          if (choice === 'blocked') {
            assert.equal(await play.count(), 0)
            await page.getByText('目前無法登場', { exact: true }).waitFor()
            results.push({ label, status: 'PASS', assertion: '登場條件不足，不提供登場按鈕且顯示目前無法登場' })
            continue
          }
          await play.click()
          const panel = page.locator('.effect-panel')
          await panel.waitFor()
          const before = await snapshot(page)
          if (choice === 'skip') {
            await panel.locator('.skip-effect').click()
          } else {
            if (card === 'BS8-104') {
              assert.equal(await panel.locator('.effect-panel-primary-action').isEnabled(), false)
              await panel.getByRole('button').filter({ hasText: 'bs8-104-on-play-discard' }).click()
              await panel.locator('.effect-panel-primary-action').click()
            }
            if (choice === 'take') {
              const targetName = { 'BS8-069': 'bs8-069-green-trash', 'BS8-090': 'bs8-090-blue-target', 'BS8-104': 'bs8-104-purple-return' }[card]
              const target = panel.getByRole('button').filter({ hasText: targetName })
              if (!(await target.count())) {
                results.push({ label, status: 'BLOCKED', reason: '合法卡片沒有出現在目標候選', targetName, body: await panel.innerText(), before })
                console.log(`BLOCKED ${label}: missing ${targetName}`)
                continue
              }
              await target.click()
            }
            await panel.locator('.effect-panel-primary-action').click()
          }
          await panel.waitFor({ state: 'hidden' })
          const after = await snapshot(page)
          if (choice === 'skip') assert.deepEqual(after, before)
          else if (card === 'BS8-069') {
            assert.equal(after.support - before.support, choice === 'take' ? 1 : 0)
            assert.equal(after.activeSupport - before.activeSupport, choice === 'take' ? 1 : 0)
            assert.equal(before.trash - after.trash, choice === 'take' ? 1 : 0)
          } else if (card === 'BS8-090') {
            assert.equal(after.hand - before.hand, choice === 'take' ? 1 : 0)
            assert.equal(before.battle - after.battle, choice === 'take' ? 1 : 0)
          } else {
            assert.equal(after.hand - before.hand, choice === 'take' ? 0 : -1)
            assert.equal(after.trash - before.trash, choice === 'take' ? 0 : 1)
            if (choice === 'take') assert.equal(await page.locator('.bottom-hand .card-face[title="bs8-104-purple-return"]').count(), 1)
          }
          assert.deepEqual(errors, [])
          const trace = await page.evaluate(() => window.__braverseContractTrace)
          if (choice === 'skip') assert.equal(trace.at(-1)?.commandKind, 'skip-on-play')
          else assert.ok(trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
          results.push({ label, status: 'PASS', before, after, trace, errors })
          await page.screenshot({ path: `test-results/bs8-extra-effects/${label}.png` })
          console.log(`PASS ${label}`)
        } catch (error) {
          results.push({ label, status: 'FAIL', error: error.message, body: await page.locator('body').innerText() })
          console.log(`FAIL ${label}: ${error.message}`)
        } finally {
          await page.close()
        }
      }
    }
  }
  if (runAttacks) {
    for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
      for (const card of ['BS8-069', 'BS8-090', 'BS8-104']) {
        for (const count of card === 'BS8-069' ? [0] : card === 'BS8-090' ? [0, 1, 2] : [0, 1]) {
          const page = await browser.newPage({ viewport })
          page.setDefaultTimeout(7000)
          const label = `${viewport.width}-${card}-attack-${count}`
          try {
            await page.goto(`${baseUrl}?test-state=bs8-extra-deck:${card}:met&contract-card=${card}`)
            await page.getByLabel('玩家 EXTRA Deck 1 張').click()
            await page.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click()
            await page.locator('.effect-panel .skip-effect').click()
            await page.locator('.effect-panel').waitFor({ state: 'hidden' })
            const before = await snapshot(page)
            const hpBefore = parseInt(await page.locator('.top-field .badge-hp').first().innerText(), 10)
            await page.locator(`[data-card-instance-id="bs8-${card.slice(4)}-demo-extra"] > .card-face`).click()
            const paymentCount = card === 'BS8-104' ? 4 : 3
            for (let index = 0; index < paymentCount; index++) {
              const support = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').first()
              await support.click()
            }
            await page.locator('.top-field .combat-card-wrap > .card-face').first().click()
            if (card === 'BS8-090') {
              await page.locator('.effect-panel .effect-panel-primary-action').click()
              const draw = page.locator('.draw-up-to-modal')
              await draw.waitFor()
              await draw.locator('.draw-up-to-option').nth(count).click()
              await draw.locator('.draw-up-to-actions button').last().click()
              await draw.waitFor({ state: 'hidden' })
            } else if (card === 'BS8-104') {
              const panel = page.locator('.effect-panel')
              await panel.waitFor()
              if (count) await panel.locator('.effect-candidates-target button').first().click()
              await panel.locator('.effect-panel-primary-action').click()
              await panel.waitFor({ state: 'hidden' })
            }
            await page.waitForFunction(({ damage, before }) =>
              parseInt(document.querySelector('.top-field .badge-hp')?.textContent ?? '', 10) === before - damage,
            { damage: card === 'BS8-104' ? 4 + count : 3, before: hpBefore })
            const after = await snapshot(page)
            assert.equal(before.activeSupport - after.activeSupport, paymentCount)
            if (card === 'BS8-090') assert.equal(after.hand - before.hand, count)
            const trace = await page.evaluate(() => window.__braverseContractTrace)
            assert.ok(trace.some(entry => entry.commandKind === 'declare-attack'))
            const hpAfter = parseInt(await page.locator('.top-field .badge-hp').first().innerText(), 10)
            results.push({ label, status: 'PASS', count, before, after, hpBefore, hpAfter, trace })
            await page.screenshot({ path: `test-results/bs8-extra-effects/${label}.png` })
            console.log(`PASS ${label}`)
          } catch (error) {
            results.push({ label, status: 'FAIL', error: error.message, body: await page.locator('body').innerText() })
            console.log(`FAIL ${label}: ${error.message}`)
          } finally {
            await page.close()
          }
        }
      }
    }
  }
} finally {
  await writeFile(`test-results/bs8-extra-effects/${attackOnly ? 'attack-report' : 'report'}.json`, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: 'EXTRA test-state initial fixtures; real entry, OnPlay and requested attack UI commands. Not full-match or online acceptance.',
    results,
  }, null, 2))
  await browser.close()
}
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
