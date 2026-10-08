import assert from 'node:assert/strict'
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
const number=process.env.BS12_BROWSER_CARD
assert.ok(['BS12-032','BS12-032@1','BS12-033','BS12-033@1'].includes(number))
assert.ok(process.env.BS12_BROWSER_OUTPUT)
const out=resolve(process.env.BS12_BROWSER_OUTPUT)
assert.equal(existsSync(out),false,'Never overwrite an earlier Browser run')
mkdirSync(out,{recursive:true})
const records=[...JSON.parse(readFileSync('data/cards/official-festival-arena-bs12.en.json')).cards,
  ...readdirSync('data/cards').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('data/cards/'+f)).cards??[])]
const art=records.filter(c=>existsSync(`test-results/bs12-official-art/${c.cardNumber}.webp`))
const cases=['positive','zero','parent-one','survives','survives-source','skip','back','deselect','parent-cost']
const read=page=>page.evaluate(()=>{
 const f=document.querySelector('.bottom-field')
 return {deck:Number(f.querySelector('.deck-zone .resource-summary > strong')?.textContent),trash:Number(f.querySelector('.discard-zone.resource-summary > strong')?.textContent),
 hand:f.querySelectorAll('.hand-card').length,breakLevel:Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
 battle:[...f.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1])}))}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({id:e.id,kind:e.commandKind,steps:e.steps})))
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const results=[]
try{
 for(const viewport of [{width:1280,height:720},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),row={number,viewport,scenario,status:'FAIL',errors:[]}
  page.on('pageerror',e=>row.errors.push(e.message))
  try{
   for(const c of art)await page.route(c.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(`test-results/bs12-official-art/${c.cardNumber}.webp`)}))
   row.fixture=number.toLowerCase()+':'+(scenario.startsWith('survives')?'hp-cost-survives':'hp-cost')
   await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.fixture+'&contract-card=BS7-008,BS12-032,BS12-033,r001-earl-grey,bs12-032-source')
   await page.locator('.game-shell').waitFor()
   await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'})
   const panel=page.locator('.effect-panel:not(.is-complete):visible')
   await panel.waitFor();row.before=await read(page);row.beforeTrace=await trace(page)
   assert.equal(row.before.battle.find(c=>c.id==='bs12-032-source').hp,scenario.startsWith('survives')?2:1)
   assert.equal(row.before.battle.find(c=>c.id==='r001-earl-grey').hp,3)
   const name=number.startsWith('BS12-032')?'Caramel Choux Cookie':'Espresso Cookie'
   const cost=panel.locator('.effect-candidates-hp-cost').getByRole('button').filter({hasText:scenario==='parent-cost'?'Earl Grey Cookie':name})
   const next=panel.getByRole('button',{name:'下一步',exact:true})
   assert.equal(await next.isEnabled(),false)
   if(scenario==='skip'){
    await panel.getByRole('button',{name:'略過整個登場效果',exact:true}).click()
    row.after=await read(page);assert.deepEqual(row.after,row.before)
   }else{
    await cost.click()
    if(scenario==='deselect'){await cost.click();assert.equal(await next.isEnabled(),false);await cost.click()}
    assert.deepEqual(await read(page),row.before)
    await next.click()
    if(scenario==='back'){await panel.getByRole('button',{name:'上一步',exact:true}).click();await next.click()}
    const targets=panel.locator('.effect-candidates').getByRole('button').filter({hasText:'玩家・戰鬥區'})
    row.parentCandidates=await targets.allTextContents()
    if(!scenario.startsWith('survives')&&scenario!=='parent-cost'){
     assert.equal(await targets.count(),1);assert.match(row.parentCandidates[0],/Earl Grey Cookie/)
    }
    if(scenario==='parent-one')await targets.filter({hasText:'Earl Grey Cookie'}).click()
    if(scenario==='survives-source')await targets.filter({hasText:name}).click()
    assert.deepEqual(await read(page),row.before)
    await panel.getByRole('button',{name:'確認發動',exact:true}).click()
    const triggered=!scenario.startsWith('survives')&&scenario!=='parent-cost'
    if(triggered){
     if(number.startsWith('BS12-032')){
      await page.getByRole('heading',{name:name+' 發動休息區移入效果',exact:true}).waitFor();row.paid=await read(page)
      if(scenario!=='zero')await page.locator('.bottom-field').getByRole('button',{name:'Earl Grey Cookie',exact:true}).click()
      await page.getByRole('button',{name:scenario==='zero'?'確認略過':'確認 (1)',exact:true}).click()
     }else{
      await page.locator('.draw-up-to-modal').waitFor();row.paid=await read(page)
      if(scenario!=='zero')await page.locator('.draw-up-to-option').filter({hasText:'抽 1 張'}).click()
      await page.getByRole('button',{name:scenario==='zero'?'略過抽牌':'抽取 1 張牌',exact:true}).click()
     }
     assert.equal(row.paid.breakLevel,1);assert.equal(row.paid.trash,row.before.trash+1)
     assert.deepEqual(row.paid.battle.map(c=>c.id),['r001-earl-grey'])
    }
    while(await page.getByRole('button',{name:'不補餅乾',exact:true}).count())await page.getByRole('button',{name:'不補餅乾',exact:true}).click()
    await page.getByRole('button',{name:'結束主要階段',exact:true}).waitFor()
    row.after=await read(page)
    const extra=triggered&&scenario!=='zero'?1:0
    assert.equal(row.after.deck,row.before.deck-(scenario==='parent-one'||scenario==='survives-source'?1:0)-extra)
    assert.equal(row.after.hand,row.before.hand+(number.startsWith('BS12-033')?extra:0))
    assert.equal(row.after.battle.find(c=>c.id==='r001-earl-grey').hp,3-(scenario==='parent-cost'?1:0)+(scenario==='parent-one'?1:0)+(number.startsWith('BS12-032')?extra:0))
    assert.equal(row.after.breakLevel,triggered?1:0)
    if(!triggered)assert.equal(row.after.battle.find(c=>c.id==='bs12-032-source').hp,scenario==='survives-source'?2:1)
   }
   row.trace=(await trace(page)).filter(e=>!row.beforeTrace.some(b=>b.id===e.id))
   assert.ok(row.trace.length,'Public commands must be recorded')
   if(scenario!=='skip')assert.ok(row.trace.some(e=>e.kind==='begin-activate-skill'))
   const triggered=!scenario.startsWith('survives')&&scenario!=='parent-cost'&&scenario!=='skip'
   assert.equal(row.trace.some(e=>e.kind==='resolve-after-damage-effect'),triggered)
   assert.equal(row.trace.some(e=>e.kind==='resolve-draw-up-to'),triggered&&number.startsWith('BS12-033'))
   row.art=await page.evaluate(urls=>[...document.images].filter(i=>urls.includes(i.src)).map(i=>({url:i.src,width:i.naturalWidth})),art.map(c=>c.imageUrl))
   assert.ok(row.art.every(i=>i.width>0));assert.deepEqual(row.errors,[])
   await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}.png`)})
   row.status='PASS';console.log('PASS',number,scenario,viewport.width)
  }catch(e){row.error=String(e);await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}-failed.png`)});throw e}
  finally{results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));await page.close()}
 }
}finally{await browser.close()}
