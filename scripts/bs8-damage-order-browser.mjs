import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: [process.env.PLAYWRIGHT_NODE_MODULES ?? process.cwd()] })).href)
const browser = await (module.chromium ?? module.default.chromium).launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const output = resolve('test-results/bs8-desktop-tablet-2026-09-07')
await mkdir(output, { recursive: true })
const baseUrl = process.env.BRAVERSE_ORDER_BASE_URL ?? 'http://127.0.0.1:5173'
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const visible = locator => locator.first().isVisible().catch(() => false)
const hp = page => page.locator('.battle-row .combat-card-wrap').evaluateAll(nodes => nodes.map(n=>({id:n.dataset.cardInstanceId,hp:Number(n.querySelector('.badge-hp').textContent.split('/')[0]),side:n.closest('.top-field')?'opponent':'self'})))
const results=[]
async function drive(page,result) {
  let selected=false
  for(let step=0;step<35;step++) {
    const panel=page.locator('.effect-panel[role="alertdialog"]:visible').first()
    if(await visible(panel)) {
      const optional=panel.locator('.optional-cost-attack-inline')
      if(await visible(optional)) {await optional.locator('.modal-actions-decision button').filter({hasText:/略過|Skip/}).click();result.operations.push('decline-optional-red');await wait(250);continue}
      const candidates=panel.locator('.effect-candidates-target button')
      if(await candidates.count() && !selected) {
        const count=await candidates.count();assert.equal(count,result.card==='BS8-005'&&result.surface!=='attack-then'?2:3,'Every eligible target must appear in one order selector')
        result.candidates=await candidates.allInnerTexts()
        if(['BS8-009','BS8-021'].includes(result.card)) assert.ok(result.candidates.every(text=>!text.includes('Burning Spice Cookie')),'Excluded Burning Spice is selectable')
        if(result.card==='BS8-005') assert.ok(result.candidates.every(text=>!text.includes('Avatar of Ruin')),'Source Avatar must not be a target')
        result.clicked=[]
        for(let index=count-1;index>=0;index--) {await candidates.nth(index).click();result.clicked.push(result.candidates[index]);await wait(80)}
        result.selected=await candidates.allInnerTexts()
        for(let index=0;index<count;index++) assert.match(result.selected[index],new RegExp(`第 ${count-index} 順位`))
        result.orderScreenshot=resolve(output,`damage-order-${result.card}-${result.surface}-${result.viewport.width}-${Date.now()}.png`)
        await page.screenshot({path:result.orderScreenshot})
        selected=true;result.operations.push('reverse-select-all');continue
      }
      const primary=panel.locator('.effect-panel-primary-action')
      if(await primary.isEnabled().catch(()=>false)) {result.operations.push(await primary.innerText());await primary.click();await wait(350);continue}
      const payment=panel.locator('.effect-candidates-payment button:not(.is-selected):not(:disabled)').first()
      if(await visible(payment)) {await payment.click();result.operations.push('pay');await wait(80);continue}
      throw new Error(`Panel stalled: ${await panel.innerText()}`)
    }
    if(selected) return
    throw new Error(`Expected effect panel: ${await page.locator('body').innerText()}`)
  }
  throw new Error('Effect did not settle')
}
try {
 for(const viewport of [{width:1907,height:863},{width:1164,height:777}]) {
  const page=await browser.newPage({viewport});page.setDefaultTimeout(4000)
  for(const {card,surface} of [{card:'BS8-009',surface:'skill'},{card:'BS8-021',surface:'item'},{card:'BS8-005',surface:'on-play'},{card:'BS8-005',surface:'attack-then'}].filter(c=>!process.env.BRAVERSE_ORDER_CARD||c.card===process.env.BRAVERSE_ORDER_CARD)) {
   const result={card,surface,viewport,operations:[]}
   try {
    await page.goto(`${baseUrl}/?test-state=${card==='BS8-005'?'bs8-extra-deck:BS8-005:order':`card:${card}`}&contract-card=${card}`);await wait(400);result.before=await hp(page)
    if(card==='BS8-005') {
      await page.getByLabel('玩家 EXTRA Deck 1 張',{exact:true}).click()
      await page.getByRole('button',{name:'從 EXTRA 登場',exact:true}).click()
      await wait(250)
      if(surface==='attack-then') {
        const setup={card,surface:'setup-on-play',viewport,operations:[]};await drive(page,setup);await wait(250);result.onPlaySetup=setup;result.before=await hp(page)
        await page.locator('.bottom-field [data-card-instance-id="bs8-005-demo-avatar"] .card-face').first().click()
        for(let i=0;i<3;i++) {const payment=page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last();await payment.focus();await payment.press('Enter');await wait(80)}
        result.attackedId=result.before.find(c=>c.side==='opponent').id
        await page.locator('.top-field .combat-card-wrap .card-face').first().click();await wait(700)
      }
    }
    else if(card==='BS8-009') await page.locator('.bottom-field .skill-action').first().click()
    else {const hand=page.locator('.bottom-hand .hand-card-wrap.is-actionable').first();await hand.locator('.hand-card').click();await hand.locator('.hand-card-action').click()}
    await wait(250);await drive(page,result);await wait(250);result.after=await hp(page)
    for(const before of result.before) {const after=result.after.find(n=>n.id===before.id);assert.ok(after,'Unexpected fainting in nonlethal fixture');const expected=card==='BS8-005'?(surface==='on-play'?(before.side==='opponent'?1:0):(before.id==='bs8-005-demo-avatar'?0:before.id===result.attackedId?4:1)):(before.id.includes(card==='BS8-009'?'player-one-BS8-009':'BS8-021-burning-spice')?0:1);assert.equal(before.hp-after.hp,expected,`${before.id} HP delta`)}
    result.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
    assert.ok(result.trace.some(entry=>entry.commandKind===(surface==='attack-then'?'resolve-attack-effect':'resolve-ability-effect')),'Missing resolution trace')
    const targetStep=result.trace.flatMap(entry=>entry.steps).filter(text=>text.includes('效果目標：')).at(-1)
    assert.ok(targetStep,'Missing ordered target trace')
    const names=targetStep.split('效果目標：')[1].split('、')
    assert.equal(names.length,result.clicked.length)
    names.forEach((name,index)=>assert.ok(result.clicked[index].includes(name),'Trace target order differs from the actual reverse clicks'))
    result.status='PASS'
   } catch(error) {result.status='FAIL';result.error=error.message;result.body=await page.locator('body').innerText();result.trace=await page.evaluate(()=>window.__braverseContractTrace??[])}
   results.push(result);console.log(result.status,card,viewport.width,result.error?.split('\n')[0]??'')
  }
  await page.close()
 }
 const path=resolve(output,`damage-order-browser-${Date.now()}.json`)
 await writeFile(path,JSON.stringify({scope:'DOM reverse target order and public HP/trace on local fixtures; not online acceptance',results},null,2),{flag:'wx'});console.log(path)
 process.exitCode=results.some(result=>result.status==='FAIL')?1:0
} finally {await browser.close()}
