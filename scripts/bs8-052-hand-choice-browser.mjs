import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const require=createRequire(import.meta.url)
const module=await import(pathToFileURL(require.resolve('playwright',{paths:[process.env.PLAYWRIGHT_NODE_MODULES??process.cwd()]})).href)
const browser=await (module.chromium??module.default.chromium).launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true})
const output=resolve('test-results/bs8-desktop-tablet-2026-09-07');await mkdir(output,{recursive:true})
const records=JSON.parse(await readFile('data/cards/official-land-of-fire-and-ruin-realm-of-apathy-bs8.en.json','utf8')).cards
const greenNames=['BS8-053','BS8-064','BS8-070'].map(id=>{const card=records.find(c=>c.cardNumber===id);assert.equal(card.color,'GREEN');return card.name})
const redName=records.find(c=>c.cardNumber==='BS8-007').name
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const visible=locator=>locator.first().isVisible().catch(()=>false)
const snapshot=page=>page.locator('.bottom-field').evaluate(row=>({
  battle:Array.from(row.querySelectorAll('.combat-card-wrap')).map(n=>({id:n.dataset.cardInstanceId,hp:Number(n.querySelector('.badge-hp').textContent.split('/')[0])})),
  trash:Number(row.querySelector('[title^="棄牌區"]')?.title.match(/\d+/)?.[0]),
  support:Array.from(row.querySelectorAll('.support-card-wrap')).map(n=>({id:n.dataset.cardInstanceId,rested:n.querySelector('.card-face').classList.contains('is-rested')})),
  hand:row.querySelectorAll('.bottom-hand .hand-card-wrap').length,
}))
const results=[]
try {
 for(const viewport of [{width:1907,height:863},{width:1164,height:777}]) {
  const page=await browser.newPage({viewport});page.setDefaultTimeout(4500)
  for(const amount of [0,1,2]) {
   const result={viewport,amount}
   try {
    await page.goto('http://127.0.0.1:5173/?test-state=card-skill:BS8-052&contract-card=BS8-052');await wait(400)
    result.before=await snapshot(page)
    const source=result.before.battle.find(n=>n.id.includes('BS8-052'));assert.ok(source)
    await page.locator('.bottom-field .skill-action').first().click();await wait(200)
    const panel=page.locator('.effect-panel[role="alertdialog"]:visible')
    const candidates=panel.locator('.effect-candidates-target button')
    for(let step=0;step<5 && !(await candidates.count());step++) {await panel.locator('.effect-panel-primary-action').click();await wait(180)}
    assert.equal(await candidates.count(),3,'All three eligible green hand cards must remain available')
    result.candidates=await candidates.allInnerTexts()
    assert.ok(greenNames.every(name=>result.candidates.some(text=>text.includes(name))))
    assert.ok(result.candidates.every(text=>!text.includes(redName)))
    assert.match(await panel.innerText(),/點選 0～2 張綠色手牌/)
    assert.match(await panel.innerText(),/不選卡牌也可確認/)
    // Select the third candidate first to prove this is not a truncated two-card list.
    for(const index of [2,0].slice(0,amount)) await candidates.nth(index).click()
    if(amount===2) {
      await candidates.nth(1).click()
      const selected=await panel.locator('.effect-candidates-target button.is-selected').count()
      const enabled=await panel.locator('.effect-panel-primary-action').isEnabled()
      assert.ok(selected<=2||!enabled,'Selecting a third card must not enable submission')
      result.overSelection={selected,confirmationEnabled:enabled}
      if(selected===3) await candidates.nth(1).click()
    }
    assert.equal(await panel.locator('.effect-candidates-target button.is-selected').count(),amount)
    result.screenshot=resolve(output,`BS8-052-select-${amount}-${viewport.width}-${Date.now()}.png`);await page.screenshot({path:result.screenshot})
    for(let step=0;step<5 && await visible(panel);step++) {await panel.locator('.effect-panel-primary-action').click();await wait(200)}
    assert.equal(await visible(panel),false,'Selection must settle')
    result.after=await snapshot(page)
    assert.ok(!result.after.battle.some(n=>n.id===source.id),'Source must pay its trash cost even for zero')
    assert.equal(result.after.trash-result.before.trash,1+source.hp,'Source and its HP must enter trash')
    assert.equal(result.after.support.length-result.before.support.length,amount)
    assert.equal(result.before.hand-result.after.hand,amount)
    const added=result.after.support.filter(n=>!result.before.support.some(old=>old.id===n.id));assert.ok(added.every(n=>n.rested))
    if(amount>0) assert.ok(added.some(n=>n.id==='BS8-052-hand-3'),'Third green candidate must really move')
    result.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
    assert.ok(result.trace.some(e=>e.commandKind==='begin-activate-skill'))
    assert.ok(result.trace.some(e=>e.commandKind==='resolve-ability-effect'))
    result.status='PASS'
   } catch(error) {result.status='FAIL';result.error=error.message;result.body=await page.locator('body').innerText();result.trace=await page.evaluate(()=>window.__braverseContractTrace??[])}
   results.push(result);console.log(result.status,amount,viewport.width,result.error?.split('\n')[0]??'')
  }
  await page.close()
 }
 const path=resolve(output,`bs8-052-hand-choice-${Date.now()}.json`);await writeFile(path,JSON.stringify({scope:'Real DOM on local formal-card fixture; not online acceptance',results},null,2),{flag:'wx'});console.log(path)
 process.exitCode=results.some(r=>r.status==='FAIL')?1:0
}finally{await browser.close()}
