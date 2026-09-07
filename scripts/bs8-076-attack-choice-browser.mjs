import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = []
await mkdir('test-results/bs8-076-attack-choice', { recursive: true })
const snapshot = async (page) => ({
  hand: Number(await page.locator('.bottom-field .row-stat-hand .row-stat-value').innerText()),
  deck: Number(await page.locator('.bottom-field .deck-zone strong').first().innerText()),
  sourceCount: await page.locator('.bottom-field .combat-card-wrap .card-face[title="Icicle Yeti Cookie"]').count(),
  restedSupport: await page.locator('.bottom-field .support-card-wrap .card-face.is-rested').count(),
  targetHp: await page.locator('[aria-label="opp-lv1 HP 卡 5 張"]').count(),
})
try {
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const card of ['BS8-076', 'BS8-076@1']) {
      for (const choice of ['skip', 'pay']) {
        const page = await browser.newPage({ viewport })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.setDefaultTimeout(10000)
        const label = `${viewport.width}-${card}-${choice}`
        try {
          await page.goto(`${baseUrl}?test-state=card:${card}&contract-card=BS8-076`)
          await page.locator('.game-shell').waitFor()
          const before = await snapshot(page)
          await page.locator('.bottom-field .combat-card-wrap .card-face').first().click()
          await page.locator('.bottom-field .support-card-wrap .card-face').nth(0).click()
          await page.locator('.bottom-field .support-card-wrap .card-face').nth(1).click()
          await page.locator('.top-field .combat-card-wrap .card-face').first().click()
          const optional = page.locator('.optional-cost-attack-inline')
          await optional.getByRole('button', { name: '略過', exact: true }).waitFor()
          assert.equal(await optional.getByRole('button', { name: '支付', exact: true }).isEnabled(), true)
          const afterAttack = await snapshot(page)
          assert.equal(afterAttack.targetHp, 1, '先結算 1 點攻擊傷害')
          assert.equal(afterAttack.restedSupport, before.restedSupport + 2, 'BB 先支付')
          const decisionText = await optional.innerText()
          await page.screenshot({ path: `test-results/bs8-076-attack-choice/${label}-decision.png` })
          if (choice === 'pay') {
            await optional.getByRole('button', { name: '支付', exact: true }).click()
            await optional.locator('.modal-card-options button').first().click()
            await optional.getByRole('button', { name: '確認', exact: true }).click()
          } else {
            await optional.getByRole('button', { name: '略過', exact: true }).click()
          }
          await optional.waitFor({ state: 'hidden' })
          const after = await snapshot(page)
          const trace = await page.evaluate(() => window.__braverseContractTrace)
          const resolved = trace.findLast((entry) => entry.commandKind === 'resolve-optional-cost-attack')
          assert.ok(resolved, '選擇必須留下正式 command 紀錄')
          assert.equal(after.restedSupport, before.restedSupport + 2, '選擇不退還攻擊付款')
          assert.equal(after.targetHp, 1, '選擇不還原已造成的傷害')
          assert.equal(after.deck, before.deck, '入底一張並抽一張，或略過均維持牌庫張數')
          assert.equal(after.hand, before.hand + (choice === 'pay' ? 1 : 0))
          assert.equal(after.sourceCount, choice === 'pay' ? 0 : 1)
          if (choice === 'pay') {
            assert.match(resolved.steps.join('\n'), /抽 1 張牌；執行 prevent-cookie-active-next-phase/)
          } else {
            assert.match(resolved.steps.join('\n'), /略過/)
            assert.doesNotMatch(resolved.steps.at(-1), /執行 prevent-cookie-active-next-phase|抽 1 張牌/)
          }
          assert.deepEqual(errors, [])
          results.push({ label, viewport, card, choice, status: 'PASS', before, afterAttack, after, decisionText, trace, errors })
          await page.screenshot({ path: `test-results/bs8-076-attack-choice/${label}-resolved.png` })
          console.log(`PASS ${label}`)
        } catch (error) {
          results.push({ label, status: 'FAIL', error: error.message, body: await page.locator('body').innerText() })
          throw error
        } finally {
          await page.close()
        }
      }
    }
    for (const discardCount of [0, 2]) {
      const page = await browser.newPage({ viewport })
      await page.goto(`${baseUrl}?test-state=bs8-076-active-prevention&contract-card=BS8-076`)
      const modal = page.locator('.hand-discard-modal')
      await modal.waitFor()
      assert.equal(await modal.getByRole('button', { name: '確認棄置 (0)' }).isEnabled(), true)
      if (discardCount === 2) {
        const cards = modal.locator('.hand-discard-options button')
        await cards.nth(0).click()
        await cards.nth(1).click()
      }
      await modal.getByRole('button', { name: `確認棄置 (${discardCount})` }).click()
      await modal.waitFor({ state: 'hidden' })
      const target = page.locator('.bottom-field .combat-card-wrap .card-face[title="BS8-076 Active Phase Target"]')
      const rested = /is-rested/.test(await target.getAttribute('class'))
      assert.equal(rested, discardCount === 0)
      results.push({ viewport, route: 'active-prevention', discardCount, rested, status: 'PASS' })
      console.log(`PASS ${viewport.width} Active Phase discard ${discardCount}`)
      await page.close()
    }
  }
} finally {
  await writeFile('test-results/bs8-076-attack-choice/report.json', JSON.stringify({
    generatedAt: new Date().toISOString(), baseUrl,
    scope: '正式攻擊 command/UI；初始狀態為 card test-state，非完整正式開局或線上驗證。牌庫內容保持隱藏，入底以來源離場及牌庫/手牌數變化佐證。防止活躍標記由公開 command 執行紀錄佐證。',
    results,
  }, null, 2))
  await browser.close()
}
