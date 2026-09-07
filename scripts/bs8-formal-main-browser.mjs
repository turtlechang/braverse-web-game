import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const recipe = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
  import { getAllCardPoolEntries, hasFlipAbility } from './src/game/card-pool.ts';
  import { validateCustomDeck, createDeckFromCustomDeck } from './src/game/custom-deck.ts';
  import { getDeckCopyLimit } from './src/game/deck-rules.ts';
  const pool = getAllCardPoolEntries().filter(card => card.cardNumber.startsWith('BS8-') && !card.cardNumber.includes('@') && card.color.toLowerCase() === 'red' && (card.type === 'cookie' || card.type === 'flip'));
  let flips = 0;
  const selected = pool.filter(card => {
    if (getDeckCopyLimit(card.cardNumber, 'standard') !== 4) return false;
    if (hasFlipAbility(card)) { if (flips + 4 > 16) return false; flips += 4; }
    return true;
  }).slice(0, 15);
  const deck = { id: 'formal-bs8-audit', name: 'BS8 Red formal audit', format: 'standard', entries: selected.map(card => ({cardNumber: card.cardNumber, count: 4})), createdAt: '', updatedAt: '' };
  const validation = validateCustomDeck(deck.entries, {format: deck.format});
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const cards = createDeckFromCustomDeck(deck, 'player-one');
  if (cards.length !== 60 || cards.some(card => card.type !== 'cookie' || !card.id.startsWith('BS8-'))) throw new Error('Formal runtime deck mismatch');
  console.log(JSON.stringify({deck, validation, faces: cards.filter((card,index) => cards.findIndex(other => other.id === card.id) === index).map(card=>({id:card.id,name:card.name,hp:card.hp,attackCost:card.attackCost,level:card.level}))}));
`], { encoding: 'utf8' }))
const baseUrl = process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const results = []
await mkdir('test-results/bs8-formal-main', { recursive: true })
try {
 for (const viewport of [{ width: 1907, height: 863 }, {width:1164,height:777}]) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(baseUrl)
  await page.getByRole('button', { name: '建立第一副牌組', exact: true }).click()
  await page.locator('.deck-editor-page-io button').nth(1).click()
  const modal = page.getByTestId('deck-editor-import-modal')
  await modal.locator('textarea').fill(JSON.stringify(recipe.deck))
  await modal.locator('button').last().click()
  await modal.waitFor({ state: 'hidden' })
  assert.equal((await page.locator('.deck-editor-page-counter strong').innerText()).trim(), '60')
  await page.getByTestId('deck-editor-page-save').click()
  await page.locator('.main-menu-ai-options select').nth(0).selectOption('bs6-red-standard')
  await page.locator('.main-menu-ai-options select').nth(1).selectOption('1')
  await page.getByRole('button', { name: '對戰入口', exact: true }).click()
  await page.locator('.opening-setup-modal').waitFor()
  for (let step = 0; step < 30 && await page.locator('.opening-setup-modal').count(); step++) {
    const setup = page.locator('.opening-setup-modal')
    const text = await setup.innerText()
    if (text.includes('猜拳決定')) await setup.getByRole('button', { name: '石頭', exact: true }).click()
    else if (text.includes('選擇先攻或後攻')) await setup.getByRole('button', { name: '選擇先攻', exact: true }).click()
    else if (text.includes('第一次調度')) await setup.getByRole('button', { name: '保留手牌', exact: true }).click()
    else if (text.includes('放置起始餅乾')) {
      const options = await setup.locator('.setup-hand button').evaluateAll(nodes => nodes.map(node => ({name:node.querySelector(':scope > span').textContent,disabled:node.disabled})))
      const selected = options.filter(option=>!option.disabled).sort((a,b)=>recipe.faces.find(face=>face.name===a.name).attackCost-recipe.faces.find(face=>face.name===b.name).attackCost)[0]
      await setup.locator('.setup-hand button').filter({hasText:selected.name}).first().click()
    }
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(1000)
  await page.locator('.bottom-field [aria-label^="玩家狀態：行動中"]').waitFor({state:'attached'})
  await page.getByRole('button', { name: '略過支援階段', exact: true }).waitFor()
  await page.locator('.bottom-hand .card-face').first().click()
  await page.getByRole('button', { name: '支援', exact: true }).click()
  await page.getByRole('button', { name: '結束主要階段', exact: true }).click()
  await page.getByRole('button', { name: '結束回合', exact: true }).click()
  await page.waitForTimeout(4000)
  await page.getByRole('button', { name: '略過支援階段', exact: true }).waitFor()
  await page.locator('.bottom-hand .card-face').first().click()
  await page.getByRole('button', { name: '支援', exact: true }).click()
  await page.locator('.bottom-field .combat-card-wrap > .card-face').first().click()
  const unpaid = await page.locator('body').innerText()
  assert.match(unpaid,/已選 0／/)
  assert.equal(await page.locator('.top-field [aria-label^="選擇攻擊目標："]').count(),0)
  const paymentCards = page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)')
  while (await paymentCards.count()) await paymentCards.first().click()
  const legalPayment = await page.locator('body').innerText()
  assert.ok(legalPayment.includes('付款合法，請選擇'))
  const source = await page.locator('.bottom-field .combat-card-wrap').first().getAttribute('data-card-instance-id')
  await page.screenshot({path:`test-results/bs8-formal-main/${viewport.width}-payment.png`,fullPage:true})
  await page.locator('.top-field .combat-card-wrap > .card-face.is-targetable').first().click()
  await page.locator('.bottom-field [aria-label^="玩家狀態：行動中"]').waitFor({state:'attached'})
  await page.waitForTimeout(300)
  const afterAttack = await page.locator('body').innerText()
  assert.ok(!afterAttack.includes('攻擊能量支付'))
  const rested = await page.locator('.bottom-field .support-card-wrap .card-face.is-rested').count()
  assert.ok(rested > 0, 'Attack payment must rest real support cards')
  await page.screenshot({path:`test-results/bs8-formal-main/${viewport.width}-attack.png`,fullPage:true})
  assert.equal(errors.length,0)
  results.push({viewport,source,rested,errors,unpaid,legalPayment,afterAttack,url:page.url()})
  await page.close()
 }
 await writeFile('test-results/bs8-formal-main/report.json',JSON.stringify({recipe,results,scope:'Normal homepage deck import/save and random local opening; actual support and attack payment. No test-state, fixed seed, injected state, or full-match claim.'},null,2))
 console.log(JSON.stringify({passed:results.length,viewports:results.map(result=>result.viewport)}))
} finally {
  await browser.close()
}
