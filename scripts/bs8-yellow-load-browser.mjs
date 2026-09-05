import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Load/identity evidence only. No effect is activated by this scan.
const source = JSON.parse(await readFile(new URL('../data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json', import.meta.url), 'utf8'))
const auditedColor = (process.env.BS8_LOAD_COLOR ?? 'YELLOW').toUpperCase()
const expectedCount = Number(process.env.BS8_LOAD_EXPECTED_COUNT ?? 35)
const cards = source.cards.filter(
  (card) => card.color === auditedColor || card.energyType?.startsWith(auditedColor),
)
assert.equal(cards.length, expectedCount)
const baseUrl = process.env.BRAVERSE_LOAD_BASE_URL ?? 'http://localhost:5173/'
const reportUrl = process.env.BRAVERSE_LOAD_REPORT ?? new URL(
  `../test-results/bs8-${auditedColor.toLowerCase()}-load.json`,
  import.meta.url,
)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const card of cards) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    page.setDefaultTimeout(15000)
    const errors = []
    const imageRequests = []
    let imageFailure
    const failedImage = new Promise((resolve) => { imageFailure = resolve })
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('requestfailed', (request) => {
      if (request.url() !== card.imageUrl) return
      const failure = { url: request.url(), error: request.failure()?.errorText }
      imageRequests.push(failure)
      imageFailure(failure)
    })
    page.on('response', (response) => {
      if (response.url() !== card.imageUrl) return
      const entry = { url: response.url(), status: response.status() }
      imageRequests.push(entry)
      if (!response.ok()) imageFailure(entry)
    })
    // CardFace replaces failed images with text. Preserve rendered identity
    // before fallback, and require decoded artwork rather than matching src.
    await page.addInitScript(({ expectedUrl, expectedName }) => {
      const evidence = { observed: [], loaded: false, failed: false }
      window.__bs8LoadEvidence = evidence
      const capture = () => {
        for (const node of document.images) {
          if (node.alt !== expectedName && node.getAttribute('src') !== expectedUrl) continue
          const entry = { alt: node.alt, src: node.getAttribute('src') }
          if (!evidence.observed.some((old) => old.alt === entry.alt && old.src === entry.src)) {
            evidence.observed.push(entry)
          }
          if (entry.src === expectedUrl && node.complete && node.naturalWidth > 0) evidence.loaded = true
        }
      }
      new MutationObserver(capture).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'alt'] })
      document.addEventListener('load', capture, true)
      document.addEventListener('error', (event) => {
        if (event.target instanceof HTMLImageElement && event.target.getAttribute('src') === expectedUrl) {
          capture()
          evidence.failed = true
        }
      }, true)
    }, { expectedUrl: card.imageUrl, expectedName: card.name })
    try {
      const route = new URL(baseUrl)
      route.searchParams.set('test-state', `card:${card.cardNumber}`)
      await page.goto(route.href, { waitUntil: 'domcontentloaded' })
      await page.locator('.game-shell').waitFor()
      assert.equal(new URL(page.url()).searchParams.get('test-state'), `card:${card.cardNumber}`)
      // OnPlay fixtures can replace the initial message before the first read;
      // exact rendered artwork identifies the variant, not that transient toast.
      const routeLabel = (await page.locator('body').innerText()).split('\n')[0]
      if (card.type === 'extra') await page.getByLabel('玩家 EXTRA Deck 1 張').click()
      await Promise.race([
        page.waitForFunction(() => window.__bs8LoadEvidence.loaded || window.__bs8LoadEvidence.failed).catch((error) => ({ timeout: error.message })),
        failedImage,
      ])
      const art = await page.evaluate(() => window.__bs8LoadEvidence)
      const identityPassed = art.observed.some((entry) => entry.src === card.imageUrl && entry.alt === card.name)
      const artworkStatus = art.loaded ? 'PASS' : imageRequests.some((entry) => entry.error === 'net::ERR_NETWORK_ACCESS_DENIED') ? 'BLOCKED_NETWORK' : 'FAIL'
      const status = identityPassed && artworkStatus === 'PASS' && errors.length === 0 ? 'PASS' : artworkStatus === 'BLOCKED_NETWORK' && identityPassed && errors.length === 0 ? 'BLOCKED_NETWORK' : 'FAIL'
      results.push({ cardNumber: card.cardNumber, name: card.name, expectedImageUrl: card.imageUrl, status, identityStatus: identityPassed ? 'PASS' : 'FAIL', artworkStatus, routeLabel, art, imageRequests, errors })
      console.log(`${status} load ${card.cardNumber}: identity=${identityPassed ? 'PASS' : 'FAIL'} artwork=${artworkStatus}`)
    } catch (error) {
      results.push({ cardNumber: card.cardNumber, status: 'FAIL', error: error.message, imageRequests, errors })
      console.log(`FAIL load ${card.cardNumber}: ${error.message}`)
    } finally { await page.close() }
  }
} finally { await browser.close() }
const summary = {
  total: results.length,
  identityPassed: results.filter((result) => result.identityStatus === 'PASS').length,
  artworkLoaded: results.filter((result) => result.artworkStatus === 'PASS').length,
  passed: results.filter((result) => result.status === 'PASS').length,
  blockedNetwork: results.filter((result) => result.status === 'BLOCKED_NETWORK').length,
  failed: results.filter((result) => result.status === 'FAIL').length,
}
await writeFile(reportUrl, JSON.stringify({ scope: `Rendered BS8 ${auditedColor} card/variant identity and decoded artwork only; not semantic or full-match acceptance`, summary, results }, null, 2))
console.log(JSON.stringify(summary))
if (results.some((result) => result.status !== 'PASS')) process.exitCode = 1
