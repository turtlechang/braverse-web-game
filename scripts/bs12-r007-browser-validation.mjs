import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
const number=process.env.BS12_BROWSER_CARD,out=resolve(process.env.BS12_BROWSER_OUTPUT??'')
assert.ok(['BS12-062','BS12-077'].includes(number));assert.ok(process.env.BS12_BROWSER_OUTPUT);assert.equal(existsSync(out),false);mkdirSync(out,{recursive:true})
const records=[...JSON.parse(readFileSync('data/cards/official-festival-arena-bs12.en.json')).cards,...readdirSync('data/cards').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('data/cards/'+f)).cards??[])]
const art=records.filter(c=>existsSync(`test-results/bs12-official-art/${c.cardNumber}.webp`)),sourceRecord=records.find(c=>c.cardNumber===number)
const short=number.slice(-3),prefix=number.toLowerCase(),blue=short==='062',sourceId=prefix+'-source',hostId=prefix+'-host'
const cases=['positive','rested-source','rested-host','wrong-host','no-energy','wrong-energy','rested-energy','opponent-turn','outside-main','hand-five','hand-six','draw-zero','draw-one','draw-two','cancel-payment','cancel-target','deselect','generic-positive','generic-negative']
const blocked=['wrong-host','no-energy','wrong-energy','rested-energy','opponent-turn','outside-main','generic-negative']
const traceCards=[...new Set(records.filter(c=>c.cardNumber.startsWith('BS12-')||['P-069','BS4-090','BS4-014','BS6-008','ST4-001','BS7-061'].includes(c.cardNumber)).map(c=>c.cardNumber))]
const read=page=>page.evaluate(()=>{
 const side=name=>{const f=document.querySelector('.'+name+'-field');return{hand:f.querySelectorAll('.hand-card-wrap').length,deck:Number(f.querySelector('.deck-zone .resource-summary>strong')?.textContent),trash:Number(f.querySelector('.discard-zone.resource-summary>strong')?.textContent),support:[...f.querySelectorAll('.support-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),rested:c.querySelector('.card-face')?.classList.contains('is-rested')})),battle:[...f.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]),rested:c.querySelector('.card-face')?.classList.contains('is-rested'),equipped:c.querySelector('.badge-equip')?.getAttribute('aria-label')??null}))}}
 return{own:side('bottom'),foe:side('top')}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({id:e.id,kind:e.commandKind,summary:e.summary,steps:e.steps})))
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]'))
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[]
try{
 for(const viewport of[{width:1280,height:720},{width:1164,height:777}])for(const scenario of cases.filter(c=>!process.env.BS12_BROWSER_CASES||process.env.BS12_BROWSER_CASES.split(',').includes(c))){
  const page=await browser.newPage({viewport}),row={number,scenario,viewport,status:'FAIL',errors:[],networkFailures:[]}
  page.on('pageerror',e=>row.errors.push(e.message));page.on('requestfailed',r=>row.networkFailures.push({url:r.url(),error:r.failure()?.errorText}))
  const shot=label=>page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}-${label}.png`)})
  try{
   for(const c of art)await page.route(c.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(`test-results/bs12-official-art/${c.cardNumber}.webp`)}))
   row.route=scenario==='generic-positive'?`card:${number}`:scenario==='generic-negative'?`card-negative:${number}`:`${prefix}:equip-${scenario}`
   await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.route+'&contract-card='+traceCards.join(','))
   await page.locator('.game-shell').waitFor();await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'});await settle(page)
   row.before=await read(page);row.setupTrace=await trace(page)
   assert.equal(row.before.own.battle.length,2);assert.equal(row.before.own.battle.find(c=>c.id===sourceId).hp,3)
   assert.ok(row.setupTrace.some(c=>c.kind==='deploy-cookie'))
   const source=page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${sourceId}"]`),skill=source.getByRole('button',{name:'啟動技能',exact:true})
   await source.locator('img').first().evaluate(i=>i.decode());assert.equal(await source.locator('img').first().getAttribute('src'),sourceRecord.imageUrl)
   if(blocked.includes(scenario)){
    assert.ok(await skill.count()===0||!await skill.isEnabled());assert.deepEqual(await read(page),row.before);assert.deepEqual(await trace(page),row.setupTrace)
   }else{
    await skill.click();const panel=page.locator('.effect-panel:visible');await panel.waitFor()
    const next=panel.getByRole('button',{name:'下一步',exact:true});assert.equal(await next.isEnabled(),false)
    if(scenario==='cancel-payment'){
     await panel.getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await read(page),row.before);assert.deepEqual(await trace(page),row.setupTrace)
    }else{
     const payment=panel.locator('.effect-candidates-payment .effect-candidate-entry>button').first();await payment.click()
     if(scenario==='deselect'){await payment.click();assert.equal(await next.isEnabled(),false);await payment.click()}
     await next.click();const targets=panel.locator('.effect-candidates-target .effect-candidate-entry>button'),confirm=panel.getByRole('button',{name:'確認發動',exact:true})
     assert.equal(await targets.count(),1);assert.match(await targets.innerText(),blue?/Popping Candy Cookie/:/Rockstar Cookie/);assert.equal(await confirm.isEnabled(),false)
     if(scenario==='cancel-target'){
      await panel.getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await read(page),row.before);assert.deepEqual(await trace(page),row.setupTrace)
     }else{
      await targets.click();if(scenario==='deselect'){await targets.click();assert.equal(await confirm.isEnabled(),false);await targets.click()}
      assert.equal(await confirm.isEnabled(),true);assert.deepEqual(await trace(page),row.setupTrace)
      const preview=await read(page);assert.deepEqual({...preview,own:{...preview.own,support:row.before.own.support}},row.before)
      await shot('unpaid-target');await confirm.click();await panel.waitFor({state:'hidden'})
      await page.waitForFunction(()=>document.querySelectorAll('.bottom-field .combat-card-wrap').length===1);await settle(page)
      row.equipped=await read(page);assert.deepEqual(row.equipped.own.battle,[{...row.before.own.battle.find(c=>c.id===hostId),equipped:`查看裝備：${sourceRecord.name}`}])
      assert.equal(row.equipped.own.trash,row.before.own.trash+3);assert.equal(row.equipped.own.deck,row.before.own.deck);assert.equal(row.equipped.own.hand,row.before.own.hand);assert.deepEqual(row.equipped.foe,row.before.foe)
      assert.deepEqual(row.equipped.own.support,row.before.own.support.map((s,i)=>({...s,rested:i===0})))
      const afterTrace=await trace(page);assert.deepEqual(afterTrace.slice(row.setupTrace.length).map(c=>c.kind),['begin-activate-skill','resolve-ability-effect']);assert.match(JSON.stringify(afterTrace),/原 HP 3 張移入棄牌區.*不觸發補位登場/)
      assert.equal(await page.getByText('補位登場',{exact:true}).count(),0)
      const host=page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${hostId}"]`)
      await host.getByRole('button',{name:`查看裝備：${sourceRecord.name}`,exact:true}).click();const detail=page.getByRole('dialog',{name:`${sourceRecord.name} 卡牌詳情`});await detail.waitFor();await detail.locator('img').first().evaluate(i=>i.decode());assert.equal(await detail.locator('img').first().getAttribute('src'),sourceRecord.imageUrl);await shot('original-equipment-art');await detail.getByRole('button',{name:'關閉',exact:true}).click()
      if(scenario!=='rested-host'){
       await host.locator('.card-face.is-attackable').click();await page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="${prefix}-payment-1"] .card-face`).click();await page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${prefix}-opponent"] .card-face:not(.hp-card)`).click()
       const draw=blue&&scenario!=='hand-six'
       if(draw){const trigger=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:'Angel Lightstick 裝備效果',exact:true})});await trigger.waitFor();assert.equal((await read(page)).foe.battle[0].hp,6);await trigger.getByRole('button',{name:'發動',exact:true}).click();const chooser=page.locator('.draw-up-to-modal');await chooser.waitFor();const count=scenario==='draw-zero'?0:scenario==='draw-one'?1:2;row.drawCount=count;await chooser.getByRole('button',{name:count===0?'不抽':`抽 ${count} 張`,exact:false}).first().click();await chooser.getByRole('button',{name:count===0?'略過抽牌':`抽取 ${count} 張牌`,exact:true}).click()}
       await page.waitForFunction(data=>document.querySelector(`.top-field .combat-card-wrap[data-card-instance-id="${data.id}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes(`HP 卡 ${data.hp} 張`),{id:prefix+'-opponent',hp:blue?5:3});await settle(page)
       row.attackAfter=await read(page);assert.equal(row.attackAfter.own.hand,row.before.own.hand+(row.drawCount??0));assert.equal(row.attackAfter.own.deck,row.before.own.deck-(row.drawCount??0));assert.equal(row.attackAfter.own.battle[0].hp,row.before.own.battle.find(c=>c.id===hostId).hp);assert.equal(row.attackAfter.own.battle[0].rested,true)
       if(!blue){assert.equal(row.attackAfter.foe.battle[1].hp,4);assert.equal(row.attackAfter.foe.battle[1].rested,false);assert.equal((await trace(page)).some(c=>c.kind==='play-blocker'),false);assert.match(JSON.stringify(await trace(page)),/Spotlight Fan.*本次戰鬥.*Blocker/)}
       if(blue&&scenario==='hand-six')assert.match(JSON.stringify(await trace(page)),/條件不成立，效果未執行/)
      }
     }
    }
   }
   row.after=await read(page);row.trace=await trace(page);await shot('result');assert.deepEqual(row.errors,[])
   row.originalArt=await page.evaluate(async urls=>{const images=[...document.querySelectorAll('img')].filter(i=>urls.includes(i.src));await Promise.all(images.map(i=>i.decode()));return images.map(i=>({url:i.src,width:i.naturalWidth,height:i.naturalHeight}))},art.map(c=>c.imageUrl));assert.ok(row.originalArt.length>0&&row.originalArt.every(i=>i.width>0));row.status='PASS'
  }catch(error){row.error=String(error.stack??error);await shot('FAIL').catch(()=>{});throw error}
  finally{results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify({number,status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',scope:'real deployment, Equip and printed host attack; original cards only; local Browser, not online',results},null,2));await page.close()}
 }
}finally{await browser.close()}
console.log(JSON.stringify({number,cases:results.length,status:'PASS'}))
