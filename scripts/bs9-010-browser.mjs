import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Run after npm run build. These are candidate-only localhost fixtures.
// No force clicks or injected commands: verify visible cards, HP order and UI gates.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'test-results/bs9-010')
mkdirSync(output, { recursive: true })
const port = Number(process.env.BRAVERSE_BS9_010_TEST_PORT ?? 4199)
const baseUrl = `http://127.0.0.1:${port}`
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const preview = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' })
const panel = (page) => page.locator('.effect-panel[role="alertdialog"]:visible').first()
const hp = (page, name) => page.locator(`[aria-label^="${name} HP 卡"]`)
const hpTitles = (page, name) => hp(page, name).locator('.hp-card').evaluateAll((cards) => cards.map((card) => card.title))

async function run(browser, viewport, scenario) {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(10000)
  const result = { scenario, viewport, status: 'FAIL', errors: [], imageFailures: [] }
  page.on('pageerror', (error) => result.errors.push(error.message))
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'image') result.imageFailures.push({ url: request.url(), reason: request.failure()?.errorText })
    else result.errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  })
  try {
    await page.goto(`${baseUrl}/?test-state=${scenario === 'negative' ? 'card-negative' : 'card'}:BS9-010&contract-card=BS9-010`)
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const dock = page.getByLabel('玩家 EXTRA Deck 1 張')
    assert.equal(await dock.getAttribute('data-extra-deck-ready'), String(scenario !== 'negative'))
    await dock.click()
    const extra = page.getByRole('dialog', { name: '玩家 EXTRA Deck' })
    if (scenario === 'negative') {
      assert.equal(await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).count(), 0)
      result.blocker = await extra.innerText()
      assert.match(result.blocker, /上一回合我方紅色 LV\.1.*尚未達到 2 張/)
      assert.equal(await hp(page, 'Shadow Milk Cookie').count(), 0)
    } else {
      await extra.getByRole('button', { name: '從 EXTRA 登場', exact: true }).click()
      const onPlay = panel(page)
      await onPlay.waitFor({ state: 'visible' })
      assert.match(await onPlay.innerText(), /對手手牌.*不查看牌面.*正面朝上.*最下方/)
      const choices = onPlay.locator('.effect-candidates-target button')
      assert.equal(await choices.count(), 2)
      assert.deepEqual(await choices.allTextContents(), ['對手手牌 1（未公開）', '對手手牌 2（未公開）'])
      const html = await onPlay.innerHTML()
      for (const name of ['Cilantro Cobra Swordsman', 'Cilantro Cobra Cookie']) assert.ok(!html.includes(name))
      await page.screenshot({ path: resolve(output, `${scenario}-${viewport.width}-blind.png`) })
      if (scenario !== 'onplay-zero') await choices.first().click()
      await onPlay.getByRole('button', { name: '確認發動', exact: true }).click()
      await onPlay.waitFor({ state: 'hidden' })
      const originalHp = Array(4).fill('未公開卡牌')
      const firstHp = scenario === 'onplay-zero' ? originalHp : ['Cilantro Cobra Swordsman', ...originalHp]
      assert.deepEqual(await hpTitles(page, 'Shadow Milk Cookie'), firstHp)
      if (scenario !== 'onplay-zero') {
        await page.locator('.bottom-field .combat-card-wrap > .card-face[title="Shadow Milk Cookie"]').click()
        await page.locator('.bottom-field .support-card[title="Ninja Cookie"]').click()
        await page.locator('.bottom-field .support-card[title="Dino-Sour Cookie"]').click()
        await page.getByRole('button', { name: '選擇攻擊目標：Peperoncino Cookie', exact: true }).click()
        const then = panel(page)
        await then.getByRole('button', { name: '支付', exact: true }).waitFor({ state: 'visible' })
        assert.equal(await hp(page, 'Peperoncino Cookie').locator('.hp-card').count(), 4)
        assert.match(await then.innerText(), /支援區 1 點無色能量/)
        if (scenario === 'then-skip') {
          await then.getByRole('button', { name: '略過', exact: true }).click()
        } else {
          await then.getByRole('button', { name: '支付', exact: true }).click()
          assert.equal(await then.getByRole('button', { name: '下一步', exact: true }).isEnabled(), false)
          const payment = then.locator('.optional-cost-col button')
          assert.equal(await payment.count(), 1)
          assert.match(await payment.innerText(), /Surprise! Lassi Jar/)
          await payment.click()
          await then.getByRole('button', { name: '下一步', exact: true }).click()
          const targets = then.locator('.optional-cost-col button')
          assert.equal(await targets.count(), 1)
          assert.match(await targets.innerText(), /Peperoncino Cookie/)
          if (scenario === 'positive') await targets.click()
          await then.getByRole('button', { name: '確認', exact: true }).click()
        }
        await then.waitFor({ state: 'hidden' })
        assert.deepEqual(await hpTitles(page, 'Shadow Milk Cookie'), scenario === 'positive' ? ['Ninja Cookie', ...firstHp] : firstHp)
        assert.equal(await hp(page, 'Peperoncino Cookie').locator('.hp-card').count(), scenario === 'positive' ? 3 : 4)
        assert.equal(await page.locator('.bottom-field .support-card.is-rested').count(), scenario === 'then-skip' ? 2 : 3)
        if (scenario === 'positive') {
          await hp(page, 'Shadow Milk Cookie').getByRole('button', { name: 'Ninja Cookie', exact: true }).click()
          const detail = page.locator('.card-detail-modal:visible')
          await detail.waitFor({ state: 'visible' })
          assert.match(await detail.innerText(), /Ninja Cookie/)
          await detail.getByRole('button', { name: /關閉/ }).click()
          await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
          const log = page.getByLabel('對戰紀錄側欄')
          const groups = log.locator('.battle-log-entry[aria-expanded="false"]')
          while (await groups.count()) await groups.first().click()
          result.publicLog = await log.innerText()
          assert.match(result.publicLog, /Cilantro Cobra Swordsman.*正面朝上.*最下方/s)
          assert.match(result.publicLog, /Ninja Cookie.*正面朝上.*最下方/s)
          assert.equal(await log.locator('.battle-log-step-card-face img[alt="Ninja Cookie"]').count() > 0, true)
          await page.screenshot({ path: resolve(output, `${scenario}-${viewport.width}-public-log.png`) })
          await log.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
        }
      }
      result.hp = await hpTitles(page, 'Shadow Milk Cookie')
    }
    assert.deepEqual(result.errors, [])
    const requiredArt = scenario === 'positive'
      ? ['Shadow Milk Cookie', 'Cilantro Cobra Swordsman', 'Ninja Cookie'] : ['Shadow Milk Cookie']
    await page.waitForFunction((names) => names.every((name) => Array.from(document.images).some((img) =>
      img.alt === name && img.src.includes('/data/en_storage/') && img.complete && img.naturalWidth > 0)) &&
      Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0), requiredArt,
    { timeout: 15000 })
    result.status = 'PASS'
    result.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
    result.cardArt = await page.locator('img').evaluateAll((images) => images.map((img) => ({
      alt: img.alt, src: img.src, loaded: img.complete && img.naturalWidth > 0,
    })))
  } catch (error) {
    result.error = error.stack ?? String(error)
    result.body = await page.locator('body').innerText().catch(() => '')
  } finally {
    result.screenshot = resolve(output, `${scenario}-${viewport.width}-${result.status}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`${scenario} ${viewport.width}: ${result.status}${result.error ? ` ${result.error.split('\n')[0]}` : ''}`)
  return result
}

let browser
const results = []
try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await fetch(baseUrl).then((response) => response.ok).catch(() => false)) break
    await new Promise((done) => setTimeout(done, 250))
  }
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const scenario of ['positive', 'negative', 'onplay-zero', 'then-skip', 'then-zero']) {
      results.push(await run(browser, viewport, scenario))
    }
  }
} finally {
  await browser?.close()
  preview.kill()
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), candidateOnly: true, results }, null, 2))
}
if (results.length !== 10 || results.some((result) => result.status !== 'PASS')) process.exitCode = 1
