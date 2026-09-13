import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Candidate-only Browser acceptance for BS9-015.  The first modal selects the
// Cookie played from hand; the follow-up panel must expose only that same
// Cookie for returning its top HP card to hand.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'test-results/bs9-015')
mkdirSync(output, { recursive: true })
const port = Number(process.env.BRAVERSE_BS9_015_TEST_PORT ?? 4199)
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
  const result = { card: 'BS9-015', viewport, negative, status: 'FAIL', errors: [], imageFailures: [] }
  page.on('pageerror', (error) => result.errors.push(error.message))
  page.on('requestfailed', (request) => {
    if (request.resourceType() === 'image') {
      result.imageFailures.push({ url: request.url(), reason: request.failure()?.errorText })
    } else {
      result.errors.push(`${request.url()}: ${request.failure()?.errorText}`)
    }
  })

  try {
    const route = negative ? 'bs9-card-negative:BS9-015' : 'bs9-card:BS9-015'
    await page.goto(`${baseUrl}/?test-state=${route}&contract-card=BS9-015`, { waitUntil: 'domcontentloaded' })
    await page.locator('.game-shell').waitFor({ state: 'visible' })
    const faintModal = page.locator('.faint-response-modal:visible')
    await faintModal.waitFor({ state: 'visible' })

    const handCandidates = faintModal.locator('.faint-card-candidates button')
    if (negative) {
      assert.equal(await handCandidates.count(), 0, '無手牌時不應顯示 BS9-015 登場候選')
      assert.doesNotMatch(await faintModal.innerText(), /Capricious Wizard/)
      await faintModal.locator('.modal-actions button').filter({ hasText: '不選擇目標' }).click()
      await faintModal.waitFor({ state: 'hidden' })
      assert.equal(await visiblePanel(page).count(), 0, '略過 BS9-015 後不應建立 HP 回手面板')
      await assertTrace(page, 'resolve-faint-effect')
      const trace = await readTrace(page)
      assert.equal(trace.some((entry) => entry.commandKind === 'resolve-ability-effect'), false)
      result.blocker = '沒有手牌 Cookie，第一段可選登場明確略過，未建立第二段目標面板'
      await waitForOfficialImages(page, ['Parfait Cookie', 'Pomegranate Cookie'])
    } else {
      assert.equal(await handCandidates.count(), 1)
      assert.match(await handCandidates.first().innerText(), /Capricious Wizard/)
      await handCandidates.first().click()
      await faintModal.locator('.modal-actions button').filter({ hasText: '確認' }).click()
      await assertTrace(page, 'resolve-faint-effect')

      const effectPanel = visiblePanel(page)
      await effectPanel.waitFor({ state: 'visible' })
      const targetButtons = effectPanel.locator('.effect-candidates-target button')
      assert.equal(await targetButtons.count(), 1, 'BS9-015 第二段應只有 1 張目標')
      const targetText = await targetButtons.allTextContents()
      assert.match(targetText[0] ?? '', /Capricious Wizard/)
      assert.doesNotMatch(targetText.join(' '), /Pomegranate Cookie/)
      await page.screenshot({ path: resolve(output, `positive-${viewport.width}-target-panel.png`), fullPage: true })
      await targetButtons.first().click()
      const confirm = effectPanel.getByRole('button', { name: '確認發動', exact: true })
      assert.equal(await confirm.isEnabled(), true)
      await confirm.click()
      await effectPanel.waitFor({ state: 'hidden' })
      await assertTrace(page, 'resolve-ability-effect')
      assert.equal(await hpCards(page, 'Capricious Wizard').count(), 3, 'Capricious Wizard 應返回最上方 1 張 HP')
      assert.equal(await hpCards(page, 'Pomegranate Cookie').count(), 4, 'Pomegranate Cookie 不應被第二段效果影響')
      await waitForOfficialImages(page, ['Parfait Cookie', 'Pomegranate Cookie', 'Capricious Wizard'])
      result.targetCandidates = targetText
      result.hpAfter = {
        capriciousWizard: await hpCards(page, 'Capricious Wizard').count(),
        pomegranate: await hpCards(page, 'Pomegranate Cookie').count(),
      }
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
