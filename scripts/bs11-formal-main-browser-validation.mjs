import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

// Normal deck-editor import and a real local match. No test-state or injected GameState.
const recipe = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
  import { getAllCardPoolEntries, hasFlipAbility } from './src/game/card-pool.ts';
  import { validateCustomDeck, createDeckFromCustomDeck } from './src/game/custom-deck.ts';
  import { getDeckCopyLimit } from './src/game/deck-rules.ts';
  const pool = getAllCardPoolEntries().filter(card => card.cardNumber.startsWith('BS11-') && !card.cardNumber.includes('@') && (card.type === 'cookie' || card.type === 'flip'));
  let flips = 0;
  const selected = pool.filter(card => {
    if (getDeckCopyLimit(card.cardNumber, 'standard') !== 4) return false;
    if (hasFlipAbility(card)) { if (flips + 4 > 16) return false; flips += 4; }
    return true;
  }).slice(0, 15);
  const deck = { id: 'formal-bs11-audit', name: 'BS11 formal pool smoke', format: 'standard', entries: selected.map(card => ({cardNumber: card.cardNumber, count: 4})), createdAt: '', updatedAt: '' };
  const validation = validateCustomDeck(deck.entries, {format: deck.format});
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const cards = createDeckFromCustomDeck(deck, 'player-one');
  if (cards.length !== 60 || cards.some(card => card.type !== 'cookie' || !card.id.startsWith('BS11-'))) throw new Error('Formal runtime deck mismatch');
  console.log(JSON.stringify({deck, validation, faces: cards.filter((card,index) => cards.findIndex(other => other.id === card.id) === index).map(card => ({id:card.id,name:card.name,hp:card.hp,attackCost:card.attackCost,level:card.level}))}));
`], { encoding: 'utf8' }))

const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = []
await mkdir('test-results/bs11-formal-main', { recursive: true })
try {
  for (const viewport of [{ width: 1907, height: 863 }, { width: 1164, height: 777 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(baseUrl)
    await page.getByRole('button', { name: '建立第一副牌組', exact: true }).click()
    await page.getByRole('button', { name: '新增牌組', exact: true }).click()
    await page.locator('.deck-editor-page-io button').nth(1).click()
    const modal = page.getByTestId('deck-editor-import-modal')
    await modal.locator('textarea').fill(JSON.stringify(recipe.deck))
    await modal.locator('button').last().click()
    await modal.waitFor({ state: 'hidden' })
    assert.equal((await page.locator('.deck-editor-page-counter strong').innerText()).trim(), '60')
    await page.getByTestId('deck-editor-page-save').click()
    await page.getByRole('button', { name: '返回主選單', exact: true }).click()
    await page.locator('.main-menu-md-ai select').nth(0).selectOption('bs7-red-arena')
    await page.locator('.main-menu-md-ai select').nth(1).selectOption('1')
    await page.getByTestId('start-ai-battle').click()
    await page.locator('.opening-setup-modal').waitFor()
    for (let step = 0; step < 30 && await page.locator('.opening-setup-modal').count(); step++) {
      const setup = page.locator('.opening-setup-modal')
      const text = await setup.innerText()
      if (text.includes('猜拳決定')) await setup.getByRole('button', { name: '石頭', exact: true }).click()
      else if (text.includes('選擇先攻或後攻')) await setup.getByRole('button', { name: '選擇先攻', exact: true }).click()
      else if (text.includes('第一次調度')) await setup.getByRole('button', { name: '保留手牌', exact: true }).click()
      else if (text.includes('放置起始餅乾')) {
        const options = await setup.locator('.setup-hand button').evaluateAll(nodes => nodes.map(node => ({ name: node.querySelector(':scope > span')?.textContent, disabled: node.disabled })))
        const selected = options.filter(option => !option.disabled).sort((a, b) => recipe.faces.find(face => face.name === a.name).attackCost - recipe.faces.find(face => face.name === b.name).attackCost)[0]
        assert.ok(selected, 'formal opening must offer a legal BS11 Cookie')
        await setup.locator('.setup-hand button').filter({ hasText: selected.name }).first().click()
      }
      await page.waitForTimeout(200)
    }
    await page.locator('.opening-setup-modal').waitFor({ state: 'hidden' })
    const supportPhaseButton = page.locator('.phase-rail .next-phase-button')
    await supportPhaseButton.waitFor({ state: 'visible' })
    const savedDeck = await page.evaluate(() => {
      const value = localStorage.getItem('braverse-custom-decks')
      if (!value) return null
      const parsed = JSON.parse(value)
      return (Array.isArray(parsed) ? parsed : parsed.decks)?.find(deck =>
        deck.entries?.some(entry => entry.cardNumber === 'BS11-001'),
      ) ?? null
    })
    assert.ok(savedDeck, 'formal deck editor must persist the BS11 deck')
    assert.equal(savedDeck.entries.reduce((sum, entry) => sum + entry.count, 0), 60)
    assert.ok(savedDeck.entries.every(entry => entry.cardNumber.startsWith('BS11-')))
    const openingPhase = (await supportPhaseButton.innerText()).trim()
    assert.ok(['自動活躍中', '自動抽牌中', '略過支援階段', '結束主要階段', '結束回合', '等待對手行動'].includes(openingPhase), `formal game did not enter a playable phase: ${openingPhase}`)
    const openingHandCount = await page.locator('.bottom-hand .card-face').count()
    assert.ok(openingHandCount > 0, 'the formal battle view must show the player hand from the saved BS11 deck')
    assert.ok(await page.locator('.phase-rail[aria-label="回合階段"]').count() === 1, 'the normal battle HUD must be mounted')
    await page.screenshot({ path: `test-results/bs11-formal-main/${viewport.width}-formal-opening.png`, fullPage: true })
    assert.equal(errors.length, 0)
    results.push({ viewport, savedDeckEntries: savedDeck.entries.length, openingPhase, openingHandCount, errors, url: page.url() })
    await page.close()
  }
  await writeFile('test-results/bs11-formal-main/report.json', JSON.stringify({ recipe, results, scope: 'Normal formal deck import/save and randomized opening setup into the real battle board. No test-state, fixed seed, injected state, support/effect test, or full-match claim.' }, null, 2))
  console.log(JSON.stringify({ passed: results.length, viewports: results.map(result => result.viewport) }))
} finally {
  await browser.close()
}
