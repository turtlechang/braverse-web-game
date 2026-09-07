import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const playwright = await import(pathToFileURL(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES ?? process.cwd()] })).href)
const browser = await (playwright.chromium ?? playwright.default.chromium).launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const baseUrl = process.env.BRAVERSE_OPTIONAL_BASE_URL ?? 'http://127.0.0.1:5173'
const output = resolve('test-results/bs8-desktop-tablet-2026-09-07')
await mkdir(output, { recursive: true })
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const visible = async locator => await locator.first().isVisible().catch(() => false)
const results = []
const snapshot = page => page.evaluate(() => Object.fromEntries(['top', 'bottom'].map(side => {
  const row = document.querySelector(`.${side}-field`)
  return [side, {
    hp: Array.from(row.querySelectorAll('[data-card-instance-id]')).filter(n => n.querySelector('.badge-hp')).map(n => ({ id: n.dataset.cardInstanceId, hp: Number(n.querySelector('.badge-hp').textContent.split('/')[0]) })),
    deck: Number(row.querySelector('[title^="牌庫剩餘"]')?.title.match(/\d+/)?.[0]),
    trash: Number(row.querySelector('[title^="棄牌區"]')?.title.match(/\d+/)?.[0]),
    support: Number(row.querySelector('.support-count')?.textContent.match(/\d+/)?.[0]),
    supportCards: Array.from(row.querySelectorAll('.support-card-wrap')).map(n=>({id:n.dataset.cardInstanceId,rested:n.querySelector('.card-face')?.classList.contains('is-rested')})),
  }]
})))
const setup072 = async page => {
  await page.goto(`${baseUrl}/?contract-card=BS8-072`)
  if(await visible(page.locator('.main-menu-dev-tools-label'))) await page.locator('.main-menu-dev-tools-label').click()
  await page.getByRole('button',{name:'測試對局設定',exact:true}).click()
  await page.getByTestId('scenario-player-battle-card-0').fill('BS8-070')
  await page.getByTestId('scenario-ai-battle-card-0').fill('BS8-070')
  await page.getByTestId('scenario-player-hand').fill('BS8-072')
  await page.getByTestId('scenario-player-support-count').fill('2')
  await page.getByTestId('scenario-ai-support-count').fill('3')
  await page.getByTestId('scenario-player-support-cards').fill('BS8-070,BS8-070')
  await page.getByTestId('scenario-start-button').click()
  await page.locator('.game-shell').waitFor()
}
const cases = [
  ...[{ mode:0, ids:[], delta:[0,0] }, {mode:1,ids:[0],delta:[1,0]}, {mode:1,ids:[1],delta:[0,1]}, {mode:2,ids:[0],delta:[2,0]}, {mode:2,ids:[1],delta:[0,2]}, {mode:3,ids:[0,1],delta:[1,1]}, {mode:4,ids:[0,1],delta:[2,1]}, {mode:4,ids:[1,0],delta:[1,2]}, {mode:5,ids:[0,1],delta:[2,2]}].map(c=>({card:'BS8-059',...c})),
  ...[0,1].map(mode=>({card:'BS8-067',mode,ids:[]})),
  ...[0,1,2].map(mode=>({card:'BS8-072',mode,ids:[]})),
  ...[0,1,2,3,4].map(mode=>({card:'BS8-111',mode,ids:[]})),
]
const drive = async (page,c,operations) => {
  let chose = false
  for(let i=0;i<45;i++) {
    const panel=page.locator('.effect-panel[role="alertdialog"]:visible').first()
    if(await visible(panel)) {
      const choice=panel.locator('.effect-candidates-choice button')
      if(await choice.count() && !chose) { assert.ok(await choice.count()>c.mode); await choice.nth(c.mode).click(); chose=true; operations.push(`mode:${c.mode}`); await wait(100); continue }
      const targets=panel.locator('.effect-candidates-target button')
      if(await targets.count()) {
        const selected=await panel.locator('.effect-candidates-target button.is-selected').count()
        if(selected<c.ids.length) { await targets.nth(c.ids[selected]).click(); operations.push(`target:${c.ids[selected]}`); await wait(100); continue }
      }
      const primary=panel.locator('.effect-panel-primary-action')
      if(await primary.isEnabled().catch(()=>false)) { operations.push(`confirm:${await primary.innerText()}`); await primary.click(); await wait(200); continue }
      let paid=false
      for(const selector of ['.effect-candidates-payment','.effect-candidates-cost-support','.effect-candidates-discard-hand']) {
        const candidate=panel.locator(`${selector} button:not(.is-selected):not(:disabled)`).first()
        if(await visible(candidate)) { await candidate.click(); operations.push(`cost:${selector}`); paid=true; break }
      }
      if(paid) {await wait(100);continue}
      throw new Error(`Panel stalled: ${await panel.innerText()}`)
    }
    const inspect=page.locator('.inspect-deck-modal:visible')
    if(await visible(inspect)) { const pick=inspect.locator('.inspect-deck-grid button').first(); await pick.click(); await inspect.locator('.modal-actions button:not(:disabled)').last().click(); operations.push('inspect:pick-one'); await wait(200);continue }
    if(chose) return
    if(c.card==='BS8-067' && !operations.includes('attack')) {
      await page.locator('.bottom-field .combat-card-wrap .card-face.is-attackable').first().click()
      for(let payment=0;payment<2;payment++) {const p=page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last();await p.focus();await p.press('Enter');await wait(100)}
      await page.locator('.top-field .combat-card-wrap .card-face').first().click()
      operations.push('attack');await wait(700);continue
    }
    const skill=page.locator('.bottom-field .skill-action').first()
    if(await visible(skill)) {await skill.click();operations.push('start:skill');await wait(200);continue}
    const hand=page.locator('.bottom-hand .hand-card-wrap.is-actionable').first()
    if(await visible(hand)) {await hand.locator('.hand-card').click(); await hand.locator('.hand-card-action').first().click();operations.push('start:hand-action');await wait(200);continue}
    throw new Error(`No choice reached: ${await page.locator('body').innerText()}`)
  }
  throw new Error('Operation limit')
}
try {
  for(const viewport of [{width:1907,height:863},{width:1164,height:777}]) {
    const page = await browser.newPage({viewport});page.setDefaultTimeout(3500)
    for(const c of cases.filter(c=>!process.env.CARD || c.card===process.env.CARD)) {
      const result={...c,viewport,operations:[]}
      try {
        if(c.card==='BS8-072') await setup072(page)
        else await page.goto(`${baseUrl}/?test-state=${c.card==='BS8-059'?'card-skill':'card'}:${c.card}&contract-card=${c.card}`)
        await wait(400);result.before=await snapshot(page)
        await drive(page,c,result.operations);await wait(200);result.after=await snapshot(page)
        result.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
        assert.ok(result.trace.length,'Missing command evidence')
        assert.ok(result.trace.some(entry=>entry.commandKind===(c.card==='BS8-067'?'resolve-attack-effect':'resolve-ability-effect')),'Missing actual effect resolution command')
        if(c.card==='BS8-059') {assert.deepEqual(result.before.top.hp.map((n,i)=>n.hp-result.after.top.hp[i].hp),c.delta); assert.equal(result.after.bottom.support,result.before.bottom.support-2)}
        if(c.card==='BS8-067'||c.card==='BS8-072') {assert.equal(result.after.bottom.support-result.before.bottom.support,c.mode);assert.equal(result.before.bottom.deck-result.after.bottom.deck,c.mode);const added=result.after.bottom.supportCards.filter(n=>!result.before.bottom.supportCards.some(old=>old.id===n.id));assert.equal(added.filter(n=>!n.rested).length,c.mode>0?1:0);assert.equal(added.filter(n=>n.rested).length,Math.max(0,c.mode-1))}
        if(c.card==='BS8-111') {assert.equal(result.before.bottom.deck-result.after.bottom.deck,c.mode+3,'three HP setup cards plus selected milling');assert.equal(result.after.bottom.trash-result.before.bottom.trash,c.mode+1);assert.equal(result.after.bottom.hp.find(n=>n.id.includes('BS8-111'))?.hp,3)}
        result.status='PASS'
      } catch(error) {result.status='FAIL';result.error=error.message;result.body=await page.locator('body').innerText();result.trace=await page.evaluate(()=>window.__braverseContractTrace??[]);result.screenshot=resolve(output,`optional-fail-${c.card}-${c.mode}-${viewport.width}-${Date.now()}.png`);await page.screenshot({path:result.screenshot})}
      results.push(result);console.log(result.status,c.card,c.mode,c.ids,viewport.width,result.error?.split('\n')[0]??'')
    }
    await page.close()
  }
  const path=resolve(output,`optional-count-browser-${Date.now()}.json`)
  await writeFile(path,JSON.stringify({generatedAt:new Date().toISOString(),baseUrl,scope:'Real DOM choices on local fixtures (072 via scenario form); not formal multiplayer acceptance',summary:{total:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length},results},null,2),{flag:'wx'});console.log(path)
  process.exitCode=results.some(r=>r.status==='FAIL')?1:0
} finally { await browser.close() }
