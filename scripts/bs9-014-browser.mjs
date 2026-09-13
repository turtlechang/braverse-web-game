import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Candidate-only Browser acceptance for the BS9-014 card-check fixture.
// Every action uses the rendered UI; no force clicks or injected commands.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'test-results/bs9-014')
mkdirSync(output, { recursive: true })
const port = Number(process.env.BRAVERSE_BS9_014_TEST_PORT ?? 4198)
const baseUrl = `http://127.0.0.1:${port}`
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const preview = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'),
  'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' })

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) throw new Error('Vite preview exited before serving')
    if (await fetch(baseUrl).then((response) => response.ok).catch(() => false)) return
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const panel = (page) => page.locator('.effect-panel:visible').first()
const hp = (page, name) => page.locator(`[aria-label^="${name} HP 卡"]`)
const hpTitles = (page, name) => hp(page, name).locator('.hp-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('title')))
const sourceHand = (page) => page.locator('.bottom-hand .hand-card[title="Candy Apple Cookie"]').first()

async function runCase(browser, viewport, negative) {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(12000)
  const result = { card: 'BS9-014', viewport, negative, status: 'FAIL', errors: [], imageFailures: [] }
  page.on('pageerror', (error) => result.errors.push(error.message))
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'image') result.imageFailures.push({ url: request.url(), reason: request.failure()?.errorText })
    else result.errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  })
  try {
    const route = negative ? 'card-negative:BS9-014' : 'card:BS9-014'
    await page.goto(`${baseUrl}/?test-state=${route}&contract-card=BS9-014`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    await sourceHand(page).click()
    await page.getByRole('button', { name: '登場', exact: true }).click()
    if (negative) {
      await page.waitForTimeout(250)
      assert.equal(await panel(page).count(), 0, '不足 2 張 HP 時不應開啟 OnPlay 效果面板')
      assert.match(await page.locator('body').innerText(), /目前不符合此技能的時機、條件或支付要求/)
      assert.equal(await hp(page, 'Pomegranate Cookie').locator('.hp-card').count(), 1)
      assert.equal(await hp(page, 'Candy Apple Cookie').locator('.hp-card').count(), 2)
      result.blocker = 'HP 代價候選不足，OnPlay 被規則層阻擋'
    } else {
      const effectPanel = panel(page)
      await effectPanel.waitFor({ state: 'visible' })
      const effectText = await effectPanel.innerText()
      assert.match(effectText, /棄置 2 張 HP 卡|HP 費用/)
      const hpCost = effectPanel.locator('.effect-candidates-hp-cost button')
      assert.equal(await hpCost.count(), 1)
      assert.match(await hpCost.first().innerText(), /Pomegranate Cookie/)
      await hpCost.first().click()
      await effectPanel.getByRole('button', { name: '下一步', exact: true }).click()
      const targetText = await effectPanel.innerText()
      assert.match(targetText, /對手餅乾/)
      assert.match(targetText, /正面朝上|face-up/)
      assert.match(targetText, /最下方|bottom/)
      const target = effectPanel.locator('.effect-candidates-target button').filter({ hasText: 'Melon Bun Cookie' }).first()
      assert.equal(await target.count(), 1)
      await target.click()
      await effectPanel.getByRole('button', { name: '確認發動', exact: true }).click()
      await effectPanel.waitFor({ state: 'hidden' })
      assert.equal(await hp(page, 'Pomegranate Cookie').locator('.hp-card').count(), 2)
      assert.deepEqual(await hpTitles(page, 'Candy Apple Cookie'), [
        'Soul Jam: Light of Destruction',
        '未公開卡牌',
        '未公開卡牌',
      ])
      const publicHp = hp(page, 'Candy Apple Cookie').locator('.hp-card[title="Soul Jam: Light of Destruction"]')
      assert.equal(await publicHp.count(), 1)
      await publicHp.click()
      const detail = page.locator('.card-detail-modal:visible')
      await detail.waitFor({ state: 'visible' })
      assert.match(await detail.innerText(), /Soul Jam: Light of Destruction/)
      await detail.getByRole('button', { name: /關閉/ }).click()
      await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
      const log = page.getByLabel('對戰紀錄側欄')
      await log.waitFor({ state: 'visible' })
      const collapsed = log.locator('.battle-log-entry[aria-expanded="false"]')
      while (await collapsed.count()) await collapsed.first().click()
      result.publicLog = await log.innerText()
      assert.match(result.publicLog, /Melon Bun Cookie.*HP.*正面朝上.*最下方/s)
      assert.equal(await log.locator('.battle-log-step-card-face img[alt="Soul Jam: Light of Destruction"]').count() > 0, true)
      await page.screenshot({ path: resolve(output, `positive-${viewport.width}-public-log.png`) })
      await log.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
      result.hp = await hpTitles(page, 'Candy Apple Cookie')
    }
    if (!negative) {
      await page.waitForFunction((requiredNames) => requiredNames.every((name) =>
        Array.from(document.images).some((img) => img.alt === name && img.src.includes('/data/en_storage/') && img.complete && img.naturalWidth > 0)
      ), ['Candy Apple Cookie', 'Melon Bun Cookie', 'Soul Jam: Light of Destruction'], { timeout: 15000 })
    }
    assert.deepEqual(result.errors, [])
    result.status = 'PASS'
  } catch (error) {
    result.error = error.stack ?? String(error)
    result.body = await page.locator('body').innerText().catch(() => '')
  } finally {
    result.screenshot = resolve(output, `${negative ? 'negative' : 'positive'}-${viewport.width}-${result.status}.png`)
    await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {})
    await page.close()
  }
  console.log(`${negative ? 'negative' : 'positive'} ${viewport.width}: ${result.status}${result.error ? ` ${result.error.split('\n')[0]}` : ''}`)
  return result
}

const results = []
let browser
try {
  await waitForPreview()
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    results.push(await runCase(browser, viewport, false))
    results.push(await runCase(browser, viewport, true))
  }
} finally {
  await browser?.close()
  preview.kill()
  writeFileSync(resolve(output, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), candidateOnly: true, results }, null, 2))
}
if (results.length !== 4 || results.some((result) => result.status !== 'PASS')) process.exitCode = 1
