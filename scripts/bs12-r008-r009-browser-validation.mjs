import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {chromium} from 'playwright'

const out=resolve(process.env.BS12_BROWSER_OUTPUT??'')
assert.ok(process.env.BS12_BROWSER_OUTPUT);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const records=[...JSON.parse(readFileSync('data/cards/official-festival-arena-bs12.en.json')).cards,...readdirSync('data/cards').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('data/cards/'+f)).cards??[])]
const art=records.filter(c=>existsSync(`test-results/bs12-official-art/${c.cardNumber}.webp`))
const traceCards=[...new Set(records.filter(c=>c.cardNumber.startsWith('BS12-')||['BS8-119','BS11-087','BS8-104','BS6-080','BS6-008','BS1-037','BS7-102','ST4-001'].includes(c.cardNumber)).map(c=>c.cardNumber))]
const cases=['r008-return','r008-zero','r009-bottom','r009-bottom-alt','r009-bottom-zero','r009-bottom-cancel','r009-all','r009-all-cancel','r009-cost','r009-cost-skip','r009-cost-cancel']
const read=page=>page.evaluate(()=>{
 const side=name=>{const f=document.querySelector('.'+name+'-field');return{hand:f.querySelectorAll('.hand-card-wrap').length,deck:Number(f.querySelector('.deck-zone .resource-summary>strong')?.textContent),trash:Number(f.querySelector('.discard-zone.resource-summary>strong')?.textContent),extra:Number(f.querySelector('.extra-deck-zone strong')?.textContent??f.querySelector('[aria-label*="EXTRA Deck"] strong')?.textContent),battle:[...f.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1])}))}}
 return{own:side('bottom'),foe:side('top')}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({kind:e.commandKind,summary:e.summary,steps:e.steps})))
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]'))
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[]
try{
 for(const viewport of[{width:1280,height:720},{width:1164,height:777}])for(const scenario of cases.filter(c=>!process.env.BS12_BROWSER_CASES||process.env.BS12_BROWSER_CASES.split(',').includes(c))){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[]}
  page.on('pageerror',e=>row.errors.push(e.message))
  const shot=label=>page.screenshot({path:resolve(out,`${scenario}-${viewport.width}-${label}.png`)})
  const panel=()=>page.locator('.effect-panel:visible')
  try{
   for(const c of art)await page.route(c.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(`test-results/bs12-official-art/${c.cardNumber}.webp`)}))
   await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state=bs12-rulings:'+scenario+'&contract-card='+traceCards.join(','))
   await page.locator('.game-shell').waitFor();await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'});await settle(page)
   row.before=await read(page);row.setupTrace=await trace(page)
   assert.ok(row.setupTrace.some(c=>c.kind==='play-extra-deck-cookie'))
   if(scenario.startsWith('r008-')){
    assert.equal(row.before.foe.battle.find(c=>c.id==='life-awaken').hp,8)
    assert.ok(row.setupTrace.some(c=>c.kind==='deploy-cookie'))
    if(scenario==='r008-return')await panel().locator('.effect-candidates-target .effect-candidate-entry>button').filter({hasText:'Dark Cacao Cookie'}).click()
    await shot('target');await panel().getByRole('button',{name:'確認發動',exact:true}).click();await panel().waitFor({state:'hidden'});await settle(page)
    row.after=await read(page)
    if(scenario==='r008-zero')assert.deepEqual(row.after,row.before)
    else{assert.equal(row.after.foe.trash,row.before.foe.trash+9);assert.equal(row.after.foe.hand,row.before.foe.hand+1);assert.deepEqual(row.after.foe.battle,row.before.foe.battle.filter(c=>c.id!=='life-awaken'));assert.deepEqual(row.after.own,row.before.own);assert.equal(row.after.foe.deck,row.before.foe.deck)}
   }else if(scenario.startsWith('r009-bottom')){
    assert.equal(row.before.own.battle.find(c=>c.id==='life-cream-soda').hp,3);assert.equal(row.before.own.battle.find(c=>c.id==='life-clotted').hp,4)
    await page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="life-cream-soda"]').getByRole('button',{name:'啟動技能',exact:true}).click()
    await panel().locator('.effect-candidates-payment .effect-candidate-entry>button').first().click();await panel().getByRole('button',{name:'下一步',exact:true}).click()
    assert.match(await panel().innerText(),/EXTRA 餅乾返回 EXTRA Deck/)
    if(scenario==='r009-bottom-cancel'){await panel().getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await read(page),row.before)}
    else{
     if(scenario!=='r009-bottom-zero')await panel().locator('.effect-candidates-target .effect-candidate-entry>button').filter({hasText:'Clotted Cream Cookie'}).click()
     await shot('target');await panel().getByRole('button',{name:'確認發動',exact:true}).click();await panel().waitFor({state:'hidden'});await settle(page)
     if(await page.getByRole('button',{name:'不補餅乾',exact:true}).count()){
      await page.getByRole('button',{name:'不補餅乾',exact:true}).click();await settle(page)
     }
     assert.equal(await page.getByRole('button',{name:'不補餅乾',exact:true}).count(),0)
     if(['r009-bottom','r009-bottom-alt'].includes(scenario)){
      await page.getByRole('button',{name:'對戰紀錄',exact:true}).click()
      await page.getByRole('complementary',{name:'對戰紀錄側欄',exact:true}).getByRole('button',{name:/Cream Soda Cookie.*玩家 發動/}).click()
      row.publicLog=await page.getByRole('complementary',{name:'對戰紀錄側欄',exact:true}).innerText()
      assert.match(row.publicLog,/玩家 選擇不補位/)
      await shot('final-public-log');await page.getByRole('button',{name:'關閉對戰紀錄',exact:true}).click()
     }
     row.after=await read(page);assert.equal(row.after.own.deck,row.before.own.deck)
     if(scenario==='r009-bottom-zero'){assert.equal(row.after.own.extra,row.before.own.extra);assert.deepEqual(row.after.own.battle,row.before.own.battle);assert.equal(row.after.own.trash,row.before.own.trash)}
     else{assert.equal(row.after.own.extra,row.before.own.extra+1);assert.equal(row.after.own.trash,row.before.own.trash+4);assert.equal(row.after.own.battle.length,1);assert.match(JSON.stringify(await trace(page)),/返回 EXTRA Deck/)}
    }
   }else if(scenario.startsWith('r009-all')){
    const hand=page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="life-rainbow"]');await hand.locator('button.card-face').click();await hand.getByRole('button',{name:'使用',exact:true}).click()
    assert.match(await panel().innerText(),/EXTRA 餅乾改回 EXTRA Deck/)
    await panel().locator('.effect-candidates-payment .effect-candidate-entry>button').filter({hasText:'Pudding Cookie'}).click();await shot('payment')
    if(scenario==='r009-all-cancel'){await panel().getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await read(page),row.before)}
    else{await panel().getByRole('button',{name:'確認發動',exact:true}).click();await panel().waitFor({state:'hidden'});await settle(page);row.after=await read(page);assert.equal(row.after.own.extra,row.before.own.extra+1);assert.equal(row.after.own.deck,row.before.own.deck+row.before.own.trash);assert.equal(row.after.own.trash,0);assert.equal(row.after.own.hand,row.before.own.hand-1);assert.match(JSON.stringify(await trace(page)),/一般卡 15 張.*返回 EXTRA Deck/)}
   }else{
    if(scenario==='r009-cost-skip')await panel().getByRole('button',{name:'略過',exact:true}).click()
    else{
     await panel().getByRole('button',{name:'支付',exact:true}).click();await panel().locator('.modal-card-options>button').filter({hasText:'Pudding Cookie'}).click();await panel().getByRole('button',{name:'下一步',exact:true}).click()
     const choices=panel().locator('.modal-card-options>button');row.costCandidates=await choices.allTextContents();assert.equal(row.costCandidates.length,19);assert.ok(!row.costCandidates.some(c=>c.includes('Shining Glitter Cookie')));await shot('excluded-extra')
     await panel().getByRole('button',{name:'縮小',exact:true}).click();await page.locator('.bottom-field .discard-zone').click();const publicTrash=page.getByRole('dialog');row.publicTrash=await publicTrash.innerText();assert.match(row.publicTrash,/Shining Glitter Cookie/);await shot('extra-in-public-trash');await publicTrash.getByRole('button',{name:'關閉',exact:true}).click();await page.getByRole('button',{name:'Kohlrabi Cookie 攻擊後續效果',exact:true}).click()
     if(scenario==='r009-cost-cancel'){await panel().getByRole('button',{name:'上一步',exact:true}).click();await panel().getByRole('button',{name:'返回',exact:true}).click();await panel().getByRole('button',{name:'略過',exact:true}).click()}
     else{for(let i=0;i<5;i++)await choices.nth(i).click();await panel().getByRole('button',{name:'下一步',exact:true}).click();await panel().getByRole('button',{name:'Sugar Swan Cookie Sugar Swan Cookie',exact:true}).click();await panel().getByRole('button',{name:'確認',exact:true}).click()}
    }
    await panel().waitFor({state:'hidden'});await settle(page);row.after=await read(page)
    if(scenario!=='r009-cost')assert.deepEqual(row.after,row.before)
    else{assert.equal(row.after.own.deck,row.before.own.deck+5);assert.equal(row.after.own.trash,row.before.own.trash-5);assert.equal(row.after.own.extra,row.before.own.extra);assert.equal(row.after.foe.battle.find(c=>c.id==='life-foe').hp,4)}
   }
   row.after=await read(page);row.trace=await trace(page);await shot('result');assert.deepEqual(row.errors,[])
   row.originalArt=await page.evaluate(async urls=>{const images=[...document.querySelectorAll('img')].filter(i=>urls.includes(i.src));await Promise.all(images.map(i=>i.decode()));return images.map(i=>({url:i.src,width:i.naturalWidth,height:i.naturalHeight}))},art.map(c=>c.imageUrl));assert.ok(row.originalArt.length>0&&row.originalArt.every(i=>i.width>0));row.status='PASS'
  }catch(error){row.error=String(error.stack??error);await shot('FAIL').catch(()=>{});throw error}
  finally{results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify({status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',scope:'R008/R009 actual printed parent commands and local UI; not whole-series or online acceptance',results},null,2));await page.close()}
 }
}finally{await browser.close()}
console.log(JSON.stringify({cases:results.length,status:'PASS'}))
