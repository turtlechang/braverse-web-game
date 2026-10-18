import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'

// Prepared local UI acceptance. Second response starts after an actual command
// parent for the first block; it does not claim two UI attacks from the opening.
const root='output/st6-st10/'
const output=process.env.BRAVERSE_ST7012_OUTPUT??root+'st7-012-browser-source-run1'
const port=4262
const scenarios=['positive','rested-source','wrong-color','rested-energy','no-energy','already-target','wrong-zone','cancel','skip','second-response','attack-yellow','attack-red','attack-green','attack-blue','attack-purple','attack-black','attack-insufficient','attack-wrong-color','attack-rested-source','attack-rested-energy','attack-wrong-phase','attack-faint']
const blockedAttacks=new Set(['attack-insufficient','attack-wrong-color','attack-rested-source','attack-rested-energy','attack-wrong-phase'])
const blockedResponses=new Set(['wrong-color','rested-energy','no-energy','already-target','wrong-zone'])
await mkdir(output,{recursive:true})
const rows=[]
let browser
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config',process.env.BRAVERSE_ST7012_CONFIG??root+'st7-012-source-browser.config.ts','--host','127.0.0.1','--strictPort','--port',String(port)],{stdio:['ignore','pipe','pipe']})
let serverOutput=''
for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{serverOutput+=chunk.toString()})
const publicState=page=>page.evaluate(()=>{
 const side=name=>{
  const field=document.querySelector('.'+name+'-field')
  return {trash:Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),battle:[...field.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.badge-hp')?.textContent.trim().split('/')[0]),printedHp:Number(c.querySelector('.badge-hp')?.textContent.trim().split('/')[1]),rested:c.querySelector('.card-face').classList.contains('is-rested')})),support:[...field.querySelectorAll('.support-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),rested:c.querySelector('.card-face').classList.contains('is-rested')}))}
 }
 return {own:side('bottom'),foe:side('top')}
})
const trace=page=>page.evaluate(()=>window.__braverseContractTrace??[])
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]'))
const enterBlocker=async page=>{
 await page.locator('.attack-response-modal:visible .modal-card-options button').filter({hasText:'Churro Cookie'}).click()
 const dialog=page.locator('.blocker-response-modal:visible')
 await dialog.waitFor()
 if(await dialog.locator('.blocker-candidates button.is-selected').count()===0)await dialog.locator('.blocker-candidates button').filter({hasText:'Churro Cookie'}).click()
 return dialog
}
try{
 let ready=false,lastProbe=''
 for(let attempt=0;attempt<40;attempt++){try{const response=await fetch(`http://127.0.0.1:${port}`);lastProbe='HTTP '+response.status;if(response.ok){ready=true;break}}catch(error){lastProbe=String(error.cause??error)}await new Promise(resolve=>setTimeout(resolve,100))}
 assert.ok(ready,'Candidate preview server ready: '+serverOutput+' Probe: '+lastProbe)
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of scenarios){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[],httpFailures:[]}
  page.on('pageerror',error=>row.errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text()+' @ '+message.location().url)})
  page.on('response',response=>{if(response.status()>=400)row.httpFailures.push({url:response.url(),status:response.status()})})
  const shot=label=>page.screenshot({path:`${output}/${scenario}-${viewport.width}-${label}.png`,fullPage:true})
  try{
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST7-012:${scenario}&contract-card=ST7-012`)
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const source=page.locator('.bottom-field .combat-card-wrap').filter({has:page.locator('img[alt="Churro Cookie"]')})
   if(scenario!=='wrong-zone'){
    const art=source.locator('img').first()
    await art.evaluate(image=>image.decode())
    assert.match(await art.getAttribute('src'),/OcGNtny-4rknS5sYOSvhRA\.webp/)
    assert.equal(await source.locator('.skill-action').count(),0,'Blocker has no Activate entry')
   }
   if(blockedResponses.has(scenario))await page.waitForFunction(already=>document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="player-one-${already?'ST7-012':'ST1-011'}-1"] .badge-hp`)?.textContent.trim().split('/')[0]===(already?'2':'1'),scenario==='already-target')
   await settle(page)
   row.before=await publicState(page);row.beforeTrace=await trace(page)
   await shot('before')
   if(scenario.startsWith('attack')){
    assert.equal(row.before.own.battle[0].hp,3)
    assert.equal(row.before.own.battle[0].printedHp,3)
    if(blockedAttacks.has(scenario)){
     assert.equal(await source.locator('.card-face.is-attackable').count(),0)
     if(scenario==='attack-insufficient')assert.equal(row.before.own.support.filter(support=>!support.rested).length,1)
    }else{
     await source.locator('.card-face.is-attackable').click()
     await page.locator('.bottom-field .support-card-wrap .card-face').nth(0).click()
     await page.locator('.bottom-field .support-card-wrap .card-face').nth(1).click()
     row.paymentText=await page.getByTestId('attack-payment-panel').innerText()
     assert.match(row.paymentText,/已選 2／2/)
     await shot('payment')
     await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first().click()
     if(scenario==='attack-faint'){
      await page.waitForFunction(()=>document.querySelectorAll('.top-field .combat-card-wrap').length===0)
      const decline=page.getByRole('button',{name:'不補餅乾',exact:true});if(await decline.isVisible())await decline.click()
     }else await page.waitForFunction(()=>document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim().split('/')[0]==='3')
    }
   }else if(blockedResponses.has(scenario)){
    assert.equal(await page.locator('.blocker-response-modal').count(),0)
    assert.ok(!row.beforeTrace.some(entry=>entry.commandKind==='play-blocker'))
   }else{
    let dialog=await enterBlocker(page)
    const confirm=()=>dialog.getByRole('button',{name:'使用 Blocker',exact:true})
    assert.equal(await confirm().isEnabled(),false)
    assert.equal(await dialog.locator('.blocker-hand-candidates').count(),0)
    assert.equal(await dialog.locator('.faint-payment-cost img[alt="黃色能量"]').count(),1)
    await dialog.locator('.blocker-payment-candidates button').first().click()
    assert.equal(await confirm().isEnabled(),true)
    assert.deepEqual(await publicState(page),row.before)
    assert.deepEqual(await trace(page),row.beforeTrace)
    await shot('payment')
    if(scenario==='cancel'){
     await dialog.getByRole('button',{name:'返回',exact:true}).click()
     assert.deepEqual(await publicState(page),row.before)
     assert.deepEqual(await trace(page),row.beforeTrace)
     dialog=await enterBlocker(page)
     assert.equal(await confirm().isEnabled(),false,'Returning clears draft payment')
    }
    await dialog.getByRole('button',{name:['cancel','skip'].includes(scenario)?'不使用':'使用 Blocker',exact:true}).click()
    await page.waitForFunction(({skipped,repeated})=>document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="player-one-${skipped?'ST1-011':'ST7-012'}-1"] .badge-hp`)?.textContent.trim().split('/')[0]===(skipped||repeated?'1':'2'),{skipped:['cancel','skip'].includes(scenario),repeated:scenario==='second-response'})
   }
   await settle(page);row.after=await publicState(page);row.trace=await trace(page)
   if(blockedAttacks.has(scenario))assert.deepEqual(row.after,row.before)
   else if(scenario.startsWith('attack')){
    assert.deepEqual(row.after.own.support.map(support=>support.rested),[true,true,false])
    assert.equal(row.after.own.battle[0].rested,true)
    assert.deepEqual(row.after.own.battle.map(cookie=>cookie.hp),[3,2])
    assert.deepEqual(row.after.foe.battle.map(cookie=>cookie.hp),scenario==='attack-faint'?[]:[3])
   }else if(!blockedResponses.has(scenario)){
    const skipped=['cancel','skip'].includes(scenario)
    assert.deepEqual(row.after.own.battle.map(cookie=>cookie.hp),skipped?[3,1]:scenario==='second-response'?[1,2]:[2,2])
    assert.deepEqual(row.after.own.support.map(support=>support.rested),skipped?[false,false,false]:scenario==='second-response'?[true,true,false]:[true,false,false])
    assert.equal(row.after.own.battle[0].rested,scenario==='rested-source')
    assert.equal(row.trace.filter(entry=>entry.commandKind==='play-blocker').length-row.beforeTrace.filter(entry=>entry.commandKind==='play-blocker').length,skipped?0:1)
   }
   const resultReview=page.getByRole('button',{name:'查看對戰紀錄',exact:true})
   const review=await resultReview.isVisible()
   if(review)await resultReview.click();else await page.getByTestId('battle-log-toggle').click()
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByTestId(review?'battle-log-review-export-replay':'battle-log-export-replay').click()])
   row.replay=`${output}/${scenario}-${viewport.width}-replay.json`;await download.saveAs(row.replay)
   const record=JSON.parse(await readFile(row.replay,'utf8'))
   for(const player of Object.values(record.finalState.players)){
    const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(support=>support.card),...player.battleArea.flatMap(cookie=>[cookie.card,...cookie.hpCards])]
    assert.equal(cards.length,60);assert.equal(new Set(cards.map(card=>card.instanceId)).size,60)
    const counts=new Map();for(const card of cards)counts.set(card.id,(counts.get(card.id)??0)+1)
    assert.ok([...counts.values()].every(count=>count<=4))
   }
   assert.deepEqual(row.errors,[]);row.status='PASS'
  }catch(error){row.error=String(error.stack??error);row.body=await page.locator('body').innerText();throw error}
  finally{rows.push(row);await shot(row.status);await page.close()}
 }
}finally{await writeFile(output+'/results.json',JSON.stringify(rows,null,2));await writeFile(output+'/preview-server.log',serverOutput);await browser?.close();server.kill()}
console.log(`PASS ${rows.length} ST7-012 original-printing Chrome cases`)
