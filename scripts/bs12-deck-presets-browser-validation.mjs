import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

await mkdir('output/bs12-blue-check', {recursive:true})
const colors=['blue','green','yellow','red','purple']
const recipes=colors.map(color=>JSON.parse(readFileSync(`data/decks/bs12-${color}-arena.json`,'utf8')))
const recipe=recipes[0]
const url = 'http://127.0.0.1:4193'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4193'], { stdio: 'ignore' })
let browser
try {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(url)).ok) break } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  const results = []
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1164, height: 777 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(url)
    await page.getByRole('button', { name: 'AI 對戰', exact: true }).waitFor()
    const aiSelect = page.getByLabel(/^AI 牌組/).first()
    assert.equal(await aiSelect.inputValue(), 'bs12-blue-arena')
    assert.equal(await aiSelect.locator('option').first().getAttribute('value'), 'bs12-blue-arena')
    assert.deepEqual(await aiSelect.locator('option').evaluateAll(options=>options.map(o=>o.value)),colors.map(color=>`bs12-${color}-arena`))
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('braverse-custom-decks')).decks)
    assert.equal(saved[0].name, recipe.name)
    assert.deepEqual(saved[0].entries, recipe.entries)
    assert.deepEqual(saved[0].extraDeckEntries, recipe.extraDeckEntries)
    assert.equal(saved.length,5)
    recipes.forEach((r,i)=>{assert.deepEqual(saved[i].entries,r.entries);assert.deepEqual(saved[i].extraDeckEntries,r.extraDeckEntries)})
    assert.equal(await page.getByRole('button', { name: 'AI 對戰', exact: true }).isEnabled(), true)
    await page.screenshot({ path: `output/bs12-blue-check/menu-${viewport.width}.png`, fullPage: true })
    await page.getByRole('button', { name: '線上對戰', exact: true }).click()
    const onlineSelect = page.locator('#deck-select')
    await onlineSelect.waitFor()
    const onlineDeckOptions=onlineSelect.locator('option:not([value=""])')
    assert.equal(await onlineDeckOptions.first().innerText(), recipe.name)
    assert.deepEqual((await onlineDeckOptions.allTextContents()).slice(0,5),recipes.map(r=>r.name))
    await page.getByRole('button', { name: /關閉/ }).click()
    for (const color of colors) {
      await page.getByLabel(/^AI 牌組/).first().selectOption(`bs12-${color}-arena`)
      await page.getByRole('button', { name: 'AI 對戰', exact: true }).click()
      await page.getByRole('dialog').waitFor()
      assert.ok((await page.getByRole('dialog').innerText()).includes('BS12'))
      await page.screenshot({ path: `output/bs12-blue-check/opening-${color}-${viewport.width}.png`, fullPage: true })
      await page.goto(url)
      await page.getByRole('button', { name: 'AI 對戰', exact: true }).waitFor()
      const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('braverse-custom-decks')).decks)
      assert.deepEqual(reloaded, saved)
    }
    assert.deepEqual(errors, [])
    results.push({ viewport, mainCards: 60, extraCardsByColor: [6,6,6,4,6], aiFirst: true, onlineFirst: true, openingColors: colors, reloadPreserved: true, errors })
    await page.close()
  }
  await writeFile('output/bs12-blue-check/browser-results.json', JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results))
} finally {
  await browser?.close()
  server.kill()
}
