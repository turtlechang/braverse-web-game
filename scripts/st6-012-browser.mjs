import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_ST6012_OUTPUT??'output/st6-st10/st6-012-browser-candidate'
await mkdir(output,{recursive:true})
const port=4228,rows=[]
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'})
let browser
const snapshot=page=>page.evaluate(()=>{
 const side=name=>{const field=document.querySelector(`.${name}-field`);return {
  battle:[...field.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:c.querySelector('.badge-hp').textContent.trim(),rested:c.querySelector('.card-face').classList.contains('is-rested')})),
  support:[...field.querySelectorAll('.support-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),rested:c.querySelector('.card-face').classList.contains('is-rested')})),
  trash:Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
  deck:Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent),
 }}
 return {own:side('bottom'),foe:side('top'),hand:document.querySelectorAll('.bottom-hand .hand-card-wrap').length}
})
const cases=['positive','zero','low','no-target','rested-source','rested-target','one-card',
 'cancel-payment','cancel-target','negative','wrong-phase','wrong-color','used','attack','attack-negative','attack-cancel']
try{
 for(let i=0;i<40;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{/* startup */}await new Promise(resolve=>setTimeout(resolve,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),errors=[],row={viewport,scenario,status:'FAIL'}
  page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message))
  try{
   const route=scenario.startsWith('cancel')?'positive':scenario==='attack-cancel'?'attack':scenario
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-012:${route}&contract-card=ST6-012`)
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const source=page.locator('.bottom-field .combat-card-wrap').filter({has:page.locator('img[alt="Picky Pyro-tiger"]')})
   const art=source.locator('img').first()
   await art.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Original ST6-012 art unavailable'))}))
   assert.match(await art.getAttribute('src'),/cookierunbraverse.com\/data\/en_storage\//)
   row.before=await snapshot(page)
   assert.ok(Number.isInteger(row.before.own.deck)&&Number.isInteger(row.before.foe.deck),'Visible deck counts must be actual integers')
   assert.equal(row.before.own.battle[0].hp,'2/2')
   const heals=['positive','zero','low','no-target','rested-source','rested-target','one-card'].includes(scenario)
   if(['negative','wrong-phase','wrong-color','used'].includes(scenario))assert.equal(await source.locator('.skill-action').isEnabled(),false)
   else if(scenario.startsWith('attack')){
    if(scenario==='attack-negative')assert.equal(await source.locator('.card-face.is-attackable').count(),0)
    else{
     await source.locator('.card-face.is-attackable').click()
     await page.locator('.bottom-field .support-card-wrap .card-face').nth(0).click()
     if(scenario==='attack-cancel')await page.getByRole('button',{name:'取消攻擊',exact:true}).click()
     else{
      await page.locator('.bottom-field .support-card-wrap .card-face').nth(1).click()
      assert.match(await page.getByTestId('attack-payment-panel').innerText(),/已選 2／2/)
      await page.screenshot({path:`${output}/${scenario}-${viewport.width}-payment.png`,fullPage:true})
      await page.locator('.top-field .combat-card-wrap').filter({has:page.locator('img[alt="Sour Belt Cookie"]')}).locator('.card-face[aria-label^="選擇攻擊目標："]').click()
      await page.waitForFunction(()=>document.querySelectorAll('.top-field .combat-card-wrap .badge-hp')[1]?.textContent.trim()==='2/4')
     }
    }
   }else{
    await source.locator('.skill-action').click()
    const panel=page.locator('.effect-panel')
    if(scenario==='cancel-payment')await panel.locator('.skip-effect').click()
    else{
     const payments=panel.locator('.effect-candidates-payment button')
     assert.equal(await payments.count(),scenario==='rested-source'||scenario==='rested-target'?1:3)
     if(!(await payments.first().getAttribute('class')).includes('is-selected'))await payments.first().click()
     await page.screenshot({path:`${output}/${scenario}-${viewport.width}-payment.png`,fullPage:true})
     await panel.locator('.effect-panel-primary-action').click()
     const targets=panel.locator('.effect-candidates-target button')
     assert.equal(await targets.count(),scenario==='no-target'?0:1)
     if(scenario!=='no-target')assert.match(await targets.first().innerText(),/Fire Spirit Cookie/)
     if(scenario==='zero'){for(const target of await targets.all())if((await target.getAttribute('class')).includes('is-selected'))await target.click()}
     else if(scenario!=='no-target'&&!(await targets.first().getAttribute('class')).includes('is-selected'))await targets.first().click()
     await page.screenshot({path:`${output}/${scenario}-${viewport.width}-target.png`,fullPage:true})
     if(scenario==='cancel-target')await panel.locator('.skip-effect').click()
     else await panel.locator('.effect-panel-primary-action').click()
    }
    await panel.waitFor({state:'hidden'})
    if(scenario==='one-card'){
     const refresh=page.locator('.decision-modal:visible')
     await refresh.waitFor();assert.match(await refresh.innerText(),/牌庫 Refresh/)
     const during=await snapshot(page);assert.equal(during.own.battle[1].hp,'7/6');assert.equal(during.own.deck,0)
     await refresh.locator('.modal-card-options button').first().click()
     await refresh.waitFor({state:'hidden'})
    }
   }
   row.after=await snapshot(page)
   if(heals){
    assert.equal(row.after.hand,row.before.hand)
    assert.equal(row.after.own.support.filter(s=>s.rested).length,row.before.own.support.filter(s=>s.rested).length+1)
    assert.deepEqual(row.after.foe,row.before.foe)
    if(['zero','no-target'].includes(scenario)){
     assert.deepEqual(row.after.own.battle,row.before.own.battle);assert.equal(row.after.own.deck,row.before.own.deck)
    }else if(scenario==='one-card'){
     assert.deepEqual(row.after.own.battle[0],row.before.own.battle[0]);assert.equal(row.after.own.battle[1].hp,'7/6')
     assert.equal(row.after.own.deck,row.before.own.trash-1);assert.equal(row.after.own.trash,0)
    }else{
     assert.deepEqual(row.after.own.battle[0],row.before.own.battle[0])
     assert.equal(row.after.own.battle[1].hp,scenario==='low'?'2/6':'7/6')
     assert.equal(row.after.own.battle[1].rested,row.before.own.battle[1].rested)
     assert.equal(row.after.own.deck,row.before.own.deck-1)
    }
   }else if(scenario==='attack'){
    assert.equal(row.after.foe.battle[1].hp,'2/4');assert.deepEqual(row.after.foe.battle[0],row.before.foe.battle[0])
    assert.equal(row.after.own.battle[0].rested,true);assert.deepEqual(row.after.own.battle[1],row.before.own.battle[1])
    assert.deepEqual(row.after.own.support.map(s=>s.rested),[true,true,false,false])
   }else assert.deepEqual(row.after,row.before)
   row.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
   if(heals||scenario==='attack'){
    await page.getByTestId('battle-log-toggle').click()
    const event=page.waitForEvent('download');await page.getByTestId('battle-log-export-replay').click()
    const download=await event,path=`${output}/${scenario}-${viewport.width}-replay.json`;await download.saveAs(path)
    const replay=JSON.parse(await readFile(path,'utf8'))
    if(heals){
     const begin=replay.commands.filter(c=>c.kind==='begin-activate-skill'&&c.sourceInstanceId===row.before.own.battle[0].id).at(-1)
     assert.ok(begin);assert.deepEqual(begin.paymentIds,[row.before.own.support[scenario.startsWith('rested')?2:0].id])
     assert.ok(row.trace.some(c=>c.commandKind==='begin-activate-skill'))
     if(scenario==='one-card'){
      const refresh=replay.commands.find(c=>c.kind==='refresh-deck'&&c.playerId==='player-one')
      assert.ok(refresh)
      const cost=replay.initialState.players['player-one'].discardPile.find(c=>c.instanceId===refresh.cookieInstanceId)
      assert.equal(cost?.type,'cookie');assert.ok(cost.level>=1)
      assert.equal(replay.finalState.pendingRefresh,null)
      assert.equal(replay.finalState.pendingReplacement,null)
     }
    }else{
     const attack=replay.commands.filter(c=>c.kind==='declare-attack'&&c.attackerInstanceId===row.before.own.battle[0].id).at(-1)
     assert.deepEqual(attack.supportPaymentIds,row.before.own.support.slice(0,2).map(s=>s.id))
     assert.equal(attack.targetInstanceId,row.before.foe.battle[1].id)
     assert.equal(replay.finalState.pendingBattle,null)
    }
   }
   assert.deepEqual(errors,[]);row.status='PASS'
  }catch(error){row.error=String(error.stack??error);row.body=await page.locator('body').innerText();throw error}
  finally{rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{await writeFile(`${output}/results.json`,JSON.stringify(rows,null,2));await browser?.close();server.kill()}
console.log(`PASS ${rows.length} original-printing ST6-012 Chrome cases`)
