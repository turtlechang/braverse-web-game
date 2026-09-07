import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = []
const records = JSON.parse(await readFile(new URL('../data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json', import.meta.url), 'utf8')).cards
const snapshot = async page => page.evaluate(() => {
  const side = selector => {
    const field = document.querySelector(selector)
    return {
      hand: Number(field.querySelector('.row-stat-hand .row-stat-value').textContent),
      deck: Number(field.querySelector('.deck-zone strong').textContent),
      trash: Number(field.querySelector('.discard-zone').title.match(/(\d+) 張/)[1]),
      support: [...field.querySelectorAll('.support-card-wrap')].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face').classList.contains('is-rested'),
      })),
      battle: [...field.querySelectorAll('.combat-card-wrap')].map(node => ({
        id: node.getAttribute('data-card-instance-id'),
        name: node.querySelector('.card-face').title,
        hp: parseInt(node.querySelector('.badge-hp').textContent, 10),
      })),
    }
  }
  return { self: side('.bottom-field'), opponent: side('.top-field') }
})
await mkdir('test-results/bs8-condition-boundary', { recursive: true })
try {
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const card of ['BS8-052', 'BS8-115', 'BS8-118', 'BS8-120']) {
      for (const positive of [true, false]) {
        const page = await browser.newPage({ viewport })
        page.setDefaultTimeout(7000)
        const label = `${viewport.width}-${card}-${positive ? 'positive' : 'negative'}`
        try {
          const record = records.find(entry => entry.cardNumber === card)
          const route = positive ? 'card-skill' : 'card-skill-negative'
          await page.goto(`${baseUrl}?test-state=${route}:${card}&contract-card=${card}`)
          await page.locator('.game-shell').waitFor()
          const initial = await snapshot(page)
          if (card === 'BS8-052') assert.equal(initial.opponent.support.length - initial.self.support.length, positive ? 2 : 1)
          if (card === 'BS8-115') assert.equal(initial.self.trash, positive ? 5 : 6)
          if (card === 'BS8-118') assert.equal(initial.self.trash, positive ? 15 : 14)
          if (card === 'BS8-120') assert.equal(initial.self.hand, positive ? 1 : 0)
          const onPlay = card === 'BS8-115' || card === 'BS8-118'
          if (onPlay) {
            await page.locator(`.bottom-hand .card-face[title="${record.name}"]`).click()
            await page.getByRole('button', { name: '登場', exact: true }).click()
            await page.locator(`.bottom-field .combat-card-wrap .card-face[title="${record.name}"]`).waitFor()
          }
          const baseline = await snapshot(page)
          if (onPlay) {
            assert.equal(baseline.self.hand, initial.self.hand - 1, '一般登場先消耗一張手牌')
            assert.equal(baseline.self.deck, initial.self.deck - record.hp, '一般登場先配置印刷HP')
            assert.equal(baseline.self.battle.find(entry => entry.name === record.name)?.hp, record.hp)
            assert.equal(baseline.self.trash, initial.self.trash)
          }
          if (positive) {
            if (!onPlay) await page.locator('.skill-action').click()
            const panel = page.locator('.effect-panel')
            await panel.waitFor()
            if (card === 'BS8-120') {
              await panel.getByRole('button').filter({ hasText: 'hand-filler-0' }).click()
              await panel.locator('.effect-panel-primary-action').click()
              await panel.getByRole('button').filter({ hasText: 'trash-cookie-2' }).click()
            } else if (card === 'BS8-052') {
              await panel.getByRole('button').filter({ hasText: 'Gim Cookie' }).click()
              await panel.getByRole('button').filter({ hasText: 'White Ghost Cookie' }).click()
            } else if (card === 'BS8-118') {
              await panel.locator('.effect-candidates-target button').filter({ hasText: record.name }).click()
            }
            await panel.locator('.effect-panel-primary-action').click()
            await panel.waitFor({ state: 'hidden' })
          } else if (!onPlay) {
            const skill = page.locator('.skill-action')
            assert.equal(await skill.isEnabled(), false)
            // Real pointer input on the disabled button must not enqueue an action.
            const bounds = await skill.boundingBox()
            await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
          } else {
            await page.getByText(`${record.name}的效果尚未滿足發動條件。`, { exact: true }).waitFor()
            assert.equal(await page.locator('.effect-panel').count(), 0)
            assert.equal(await page.locator('.skill-action:not(:disabled)').count(), 0)
          }
          const after = await snapshot(page)
          const trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
          if (!positive) {
            assert.deepEqual(after, baseline, '拒絕效果後，登場基線以外的HP／手牌／區域皆不變')
            assert.equal(trace.some(entry => ['begin-activate-skill', 'resolve-ability-effect'].includes(entry.commandKind)), false)
          } else {
            assert.ok(trace.some(entry => entry.commandKind === 'resolve-ability-effect'))
            assert.deepEqual(after.opponent, baseline.opponent)
            if (onPlay) {
              assert.equal(after.self.battle.find(entry => entry.name === record.name)?.hp, record.hp + 1)
              assert.equal(after.self.deck, baseline.self.deck - 1)
              assert.equal(after.self.hand, baseline.self.hand)
              assert.equal(after.self.trash, baseline.self.trash)
            } else if (card === 'BS8-052') {
              assert.equal(after.self.hand, baseline.self.hand - 2)
              assert.equal(after.self.support.length, 2)
              assert.ok(after.self.support.every(entry => entry.rested))
              assert.equal(after.self.battle.some(entry => entry.name === record.name), false)
              const sourceHp = baseline.self.battle.find(entry => entry.name === record.name).hp
              assert.equal(after.self.trash, baseline.self.trash + sourceHp + 1)
            } else {
              assert.equal(after.self.hand, baseline.self.hand - 1)
              assert.equal(after.self.battle.length, baseline.self.battle.length + 1)
              assert.equal(after.self.battle.find(entry => entry.name === 'trash-cookie-2')?.hp, 4)
              assert.equal(after.self.deck, baseline.self.deck - 4)
              assert.equal(after.self.trash, baseline.self.trash)
            }
          }
          await page.screenshot({ path: `test-results/bs8-condition-boundary/${label}.png` })
          let continued = false
          if (!positive) {
            const endMain = page.getByRole('button', { name: '結束主要階段', exact: true })
            assert.equal(await endMain.isEnabled(), true)
            await endMain.click()
            await endMain.waitFor({ state: 'hidden' })
            continued = true
          }
          results.push({ label, status: 'PASS', viewport, card, positive, initial, baseline, after, trace, continued })
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
} finally {
  await writeFile('test-results/bs8-condition-boundary/report.json', JSON.stringify({
    generatedAt: new Date().toISOString(), scope: 'Local test-state fixtures, real UI commands and public DOM. Deploy HP is measured separately; not full-match or online acceptance.', results,
  }, null, 2))
  await browser.close()
}
if (results.some(result => result.status !== 'PASS')) process.exitCode = 1
