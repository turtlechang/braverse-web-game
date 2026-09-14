import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Candidate-only Browser acceptance: fixed Ancient protection recipients,
// source-only attack bonus, and another-Ancient condition blocking.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'test-results/BS9-017')
mkdirSync(output, { recursive: true })
const port = Number(process.env.BRAVERSE_BS9_017_TEST_PORT ?? 4201)
const baseUrl = `http://127.0.0.1:${port}`
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const preview = spawn(
  process.execPath,
  [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
)

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null) throw new Error('Vite preview exited before serving')
    if (await fetch(baseUrl).then((response) => response.ok).catch(() => false)) return
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Vite preview did not start at ${baseUrl}`)
}

const readTrace = (page) => page.evaluate(() => window.__braverseContractTrace ?? [])
const assertTrace = async (page, commandKind) => {
  const trace = await readTrace(page)
  assert.ok(trace.some((entry) => entry.commandKind === commandKind), `missing ${commandKind} trace`)
}
const visiblePanel = (page) => page.locator('.effect-panel:visible').first()
const hpCards = (page, name) => page.locator(`[aria-label^="${name} HP 卡"] .hp-card`)

const waitForOfficialImages = async (page, names) => {
  await page.waitForFunction((requiredNames) => requiredNames.every((name) =>
    Array.from(document.images).some((image) =>
      image.alt === name &&
      image.src.includes('/data/en_storage/') &&
      image.complete &&
      image.naturalWidth > 0,
    ),
  ), names, { timeout: 15000 })
}

async function runCase(browser, viewport, negative) {
  const page = await browser.newPage({ viewport })
  page.setDefaultTimeout(12000)
  const result = { viewport, negative, status: 'FAIL', errors: [] }
  page.on('pageerror', error => result.errors.push(error.message))
  page.on('requestfailed', request => result.errors.push(`${request.url()}: ${request.failure()?.errorText}`))
  try {
    await page.goto(`${baseUrl}/?test-state=${negative ? 'card-negative' : 'card'}:BS9-017&contract-card=BS9-017`)
    const panel = visiblePanel(page)
    await panel.waitFor({ state: 'visible' })
    const targets = panel.locator('.effect-candidates-target button')
    assert.equal(await targets.count(), negative ? 1 : 2)
    assert.equal(await targets.filter({ hasText: 'Hollyberry Cookie' }).count(), 1)
    assert.equal(await targets.filter({ hasText: 'Golden Cheese Cookie' }).count(), negative ? 0 : 1)
    assert.equal(await targets.filter({ hasText: 'Strawberry Cookie' }).count(), 0)
    for (const button of await targets.all()) assert.equal(await button.isEnabled(), false)
    assert.match(await panel.innerText(), /3 點以上的傷害時，改為 2 點/)
    assert.doesNotMatch(await panel.innerText(), /最多 4|傷害 \+0|略過/)
    result.attackRecipients = await targets.allTextContents()
    await waitForOfficialImages(page, ['Hollyberry Cookie', negative ? 'Strawberry Cookie' : 'Golden Cheese Cookie'])
    await page.screenshot({ path: resolve(output, `${negative ? 'negative' : 'positive'}-${viewport.width}-attack.png`) })
    await panel.getByRole('button', { name: '確認發動', exact: true }).click()
    await panel.waitFor({ state: 'hidden' })
    await assertTrace(page, 'resolve-attack-effect')
    const owner = page.getByRole('region', { name: '玩家場地', exact: true })
    const holly = owner.locator('.combat-card-wrap').filter({ has: page.getByRole('button', { name: 'Hollyberry Cookie', exact: true }) })
    if (negative) {
      assert.equal(await holly.getByRole('button', { name: '啟動技能', exact: true }).isEnabled(), false)
      result.skillBlocker = await holly.innerText()
      assert.match(result.skillBlocker, /條件/)
      assert.equal((await holly.locator('.badge-atk').innerText()).trim(), '2')
    } else {
      await holly.getByRole('button', { name: '啟動技能', exact: true }).click()
      const energy = panel.getByRole('button', { name: 'Soul Jam: Light of Destruction Soul Jam: Light of Destruction', exact: true })
      await energy.first().click()
      await panel.getByRole('button', { name: '下一步', exact: true }).click()
      assert.equal(await targets.count(), 1)
      assert.match(await targets.innerText(), /Hollyberry Cookie/)
      assert.equal(await targets.isEnabled(), false)
      assert.match(await panel.innerText(), /若己方戰鬥區有另一張【Ancient】餅乾/)
      await page.screenshot({ path: resolve(output, `positive-${viewport.width}-skill.png`) })
      await panel.getByRole('button', { name: '確認發動', exact: true }).click()
      await panel.waitFor({ state: 'hidden' })
      assert.equal((await holly.locator('.badge-atk').innerText()).trim(), '4')
      const companion = owner.locator('.combat-card-wrap').filter({ has: page.getByRole('button', { name: 'Golden Cheese Cookie', exact: true }) })
      assert.equal((await companion.locator('.badge-atk').innerText()).trim(), '3')
      result.attackAfterSkill = { hollyberry: 4, goldenCheese: 3 }
    }
    assert.equal(await hpCards(page, 'Hollyberry Cookie').count(), 5)
    const opponentArea = page.getByRole('region', { name: 'AI 對手場地', exact: true })
    assert.match(await opponentArea.innerText(), /支援 6 張/)
    await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
    await page.getByRole('button', { name: '結束回合', exact: true }).click()
    await page.getByText('TURN 4', { exact: true }).waitFor({ state: 'visible', timeout: 45000 })
    await page.getByRole('button', { name: '略過支援階段', exact: true }).waitFor({ state: 'visible', timeout: 45000 })
    result.hpAfterOpponentTurn = {
      hollyberry: await hpCards(page, 'Hollyberry Cookie').count(),
      companion: await hpCards(page, negative ? 'Strawberry Cookie' : 'Golden Cheese Cookie').count(),
    }
    await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
    const attackLog = page.getByRole('complementary', { name: '對戰紀錄側欄' })
      .getByRole('button').filter({ hasText: /使用「Dark Choco Cookie」攻擊/ })
    assert.equal(await attackLog.count(), 1)
    result.opponentAttack = await attackLog.innerText()
    await page.screenshot({ path: resolve(output, `${negative ? 'negative' : 'positive'}-${viewport.width}-damage.png`) })
    if (!negative) {
      assert.match(result.opponentAttack, /攻擊「Hollyberry Cookie」/)
      assert.deepEqual(result.hpAfterOpponentTurn, { hollyberry: 3, companion: 5 })
    } else {
      assert.match(result.opponentAttack, /攻擊「Strawberry Cookie」/)
      assert.deepEqual(result.hpAfterOpponentTurn, { hollyberry: 5, companion: 1 })
    }
    assert.deepEqual(result.errors, [])
    result.status = 'PASS'
  } catch (error) {
    result.error = error.stack ?? String(error)
    result.body = await page.locator('body').innerText().catch(() => '')
  } finally {
    await page.screenshot({ path: resolve(output, `${negative ? 'negative' : 'positive'}-${viewport.width}-${result.status}.png`) })
    await page.close()
  }
  console.log(`${negative ? 'negative' : 'positive'} ${viewport.width}: ${result.status} ${result.error ?? ''}`)
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
