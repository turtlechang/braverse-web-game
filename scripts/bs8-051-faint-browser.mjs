import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const playwright = await import(pathToFileURL(require.resolve('playwright', {
  paths: [process.env.PLAYWRIGHT_NODE_MODULES ?? process.cwd()],
})).href)
const browser = await (playwright.chromium ?? playwright.default.chromium).launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
})
const baseUrl = process.env.BRAVERSE_OPTIONAL_BASE_URL ?? 'http://127.0.0.1:5173'
const output = resolve('test-results/bs8-desktop-tablet-2026-09-07')
const source = JSON.parse(await readFile('data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json', 'utf8'))
const supportCookie = source.cards.find(card => card.cardNumber === 'BS8-058')
assert.ok(supportCookie?.hp > 0)
await mkdir(output, { recursive: true })
const runId = Date.now()
const results = []
const snapshot = page => page.evaluate(() => {
  const row = document.querySelector('.bottom-field')
  return {
    deck: Number(row.querySelector('[title^="牌庫剩餘"]')?.title.match(/\d+/)?.[0]),
    support: Number(row.querySelector('.support-count')?.textContent.match(/\d+/)?.[0]),
    supportIds: [...row.querySelectorAll('.support-card-wrap')].map(node => node.dataset.cardInstanceId),
    battle: [...row.querySelectorAll('.combat-card-wrap')].map(node => ({
      id: node.dataset.cardInstanceId,
      name: node.querySelector('img')?.alt,
      hp: Number(node.querySelector('.badge-hp')?.textContent.split('/')[0]),
    })),
  }
})

try {
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    for (const scenario of ['summon', 'zero', 'negative']) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(5000)
      const result = { scenario, viewport, pageErrors: [], operations: [] }
      page.on('pageerror', error => result.pageErrors.push(error.message))
      try {
        const route = scenario === 'negative' ? 'card-skill-negative' : 'card-skill'
        await page.goto(`${baseUrl}/?test-state=${route}:BS8-051&contract-card=BS8-051`)
        const modal = page.locator('.faint-response-modal')
        await modal.waitFor()
        result.before = await snapshot(page)
        result.prompt = await modal.innerText()
        assert.match(result.prompt, /自己的支援區餅乾/)
        assert.doesNotMatch(result.prompt, /對手.*餅乾/)
        const candidates = modal.locator('.faint-card-candidates button')
        assert.equal(await candidates.count(), scenario === 'negative' ? 0 : 1)
        if (scenario !== 'negative') assert.match(await candidates.first().innerText(), new RegExp(supportCookie.name))
        result.beforeScreenshot = resolve(output, `051-${scenario}-${viewport.width}-${runId}-before.png`)
        await page.screenshot({ path: result.beforeScreenshot })
        if (scenario === 'summon') {
          await candidates.first().click()
          result.operations.push('select-support-cookie')
          assert.equal(await candidates.first().getAttribute('aria-pressed'), 'true')
        }
        const confirm = modal.locator('.modal-actions button').last()
        assert.equal(await confirm.isEnabled(), true)
        result.operations.push(`confirm:${await confirm.innerText()}`)
        await confirm.click()
        await modal.waitFor({ state: 'hidden' })
        result.after = await snapshot(page)
        result.trace = await page.evaluate(() => window.__braverseContractTrace ?? [])
        assert.ok(result.trace.some(entry => entry.commandKind === 'resolve-faint-effect'), 'Missing actual faint resolution command')
        if (scenario === 'summon') {
          assert.equal(result.after.support, result.before.support - 1)
          assert.equal(result.after.deck, result.before.deck - supportCookie.hp)
          assert.equal(result.after.battle.length, result.before.battle.length + 1)
          const added = result.after.battle.filter(card => !result.before.battle.some(old => old.id === card.id))
          assert.equal(added.length, 1)
          assert.equal(added[0].name, supportCookie.name)
          assert.equal(added[0].hp, supportCookie.hp)
          assert.ok(result.before.supportIds.includes(added[0].id), 'Summoned instance must be the previously visible support')
          assert.ok(!result.after.supportIds.includes(added[0].id))
        } else {
          assert.deepEqual(result.after, result.before, 'Zero/negative must not move any visible card or change HP/deck')
        }
        assert.deepEqual(result.pageErrors, [])
        result.status = 'PASS'
      } catch (error) {
        result.status = 'FAIL'
        result.error = error.message
        result.body = await page.locator('body').innerText()
      }
      result.afterScreenshot = resolve(output, `051-${scenario}-${viewport.width}-${runId}-after.png`)
      await page.screenshot({ path: result.afterScreenshot })
      results.push(result)
      console.log(result.status, scenario, viewport.width, result.error ?? '')
      await page.close()
    }
  }
  const path = resolve(output, `051-faint-browser-${runId}.json`)
  await writeFile(path, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl,
    scope: 'BS8-051 local official-pool fixture Browser choices; not complete-match or multiplayer acceptance',
    expectedSupportCookie: { cardNumber: supportCookie.cardNumber, name: supportCookie.name, hp: supportCookie.hp },
    summary: { total: results.length, passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length }, results,
  }, null, 2), { flag: 'wx' })
  console.log(path)
  process.exitCode = results.some(row => row.status === 'FAIL') ? 1 : 0
} finally {
  await browser.close()
}
