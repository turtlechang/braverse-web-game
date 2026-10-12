import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_ST7009_OUTPUT??'output/st6-st10/st7-009-browser-candidate',port=4255
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--strictPort','--port',String(port)],{stdio:'ignore'})
const rows=[];let browser
const publicState=page=>page.evaluate(()=>{
 const side=name=>{
  const field=document.querySelector('.'+name+'-field')
  return {trash:Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),battle:[...field.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.badge-hp')?.textContent.trim().split('/')[0]),printedHp:Number(c.querySelector('.badge-hp')?.textContent.trim().split('/')[1]),rested:c.querySelector('.card-face').classList.contains('is-rested')})),support:[...field.querySelectorAll('.support-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),rested:c.querySelector('.card-face').classList.contains('is-rested')}))}
 }
 return {own:side('bottom'),foe:side('top')}
})
try{
 for(let attempt=0;attempt<40;attempt++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of ['positive','red','yellow','green','blue','purple','black','mixed','cancel','negative','insufficient','wrong-phase','rested-source','used','faint']){
  const page=await browser.newPage({viewport}),errors=[],row={viewport,scenario,status:'FAIL'}
  page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST7-009:${scenario==='cancel'?'positive':scenario}&contract-card=ST7-009`)
   await page.locator('.bottom-field').waitFor();await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const source=page.locator('.bottom-field .combat-card-wrap').filter({has:page.locator('img[alt="Lilybell Cookie"]')}),art=source.locator('img').first()
   await art.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Original Fig art failed'))}))
   assert.match(await art.getAttribute('src'),/FTSSauU3L3itX1GLMgT0KQ\.webp/)
   row.before=await publicState(page);assert.equal(row.before.own.battle[0].hp,4);assert.equal(row.before.own.battle[0].printedHp,4)
   assert.equal(await source.locator('.skill-action').count(),0)
   await page.screenshot({path:`${output}/${scenario}-${viewport.width}-before.png`,fullPage:true})
   const blocked=['negative','insufficient','wrong-phase','rested-source','used'].includes(scenario)
   if(blocked){
    assert.equal(await source.locator('.card-face.is-attackable').count(),0)
    if(scenario==='negative')assert.equal(row.before.own.support.filter(s=>!s.rested).length,0)
    if(['wrong-phase','rested-source'].includes(scenario))assert.equal(row.before.own.support.filter(s=>!s.rested).length,3);if(scenario==='insufficient')assert.equal(row.before.own.support.filter(s=>!s.rested).length,2)
    if(scenario==='used'){assert.equal(row.before.own.battle[0].rested,true);assert.equal(row.before.own.support.filter(s=>!s.rested).length,3);assert.equal(row.before.foe.battle[0].hp,1)}
   }else{
    await source.locator('.card-face.is-attackable').click()
    await page.locator('.bottom-field .support-card-wrap .card-face').first().click();await page.locator('.bottom-field .support-card-wrap .card-face').nth(1).click();await page.locator('.bottom-field .support-card-wrap .card-face').nth(2).click()
    const payment=page.getByTestId('attack-payment-panel');row.paymentText=await payment.innerText();assert.match(row.paymentText,/已選 3／3/)
    await page.screenshot({path:`${output}/${scenario}-${viewport.width}-payment.png`,fullPage:true})
    if(scenario==='cancel')await page.getByRole('button',{name:'取消攻擊',exact:true}).click()
    else{
     const targets=page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]');assert.equal(await targets.count(),2);await targets.first().click()
     await payment.waitFor({state:'hidden'})
     if(scenario==='faint'){
      await page.waitForFunction(()=>document.querySelectorAll('.top-field .combat-card-wrap').length===1)
      const decline=page.getByRole('button',{name:'不補餅乾',exact:true});if(await decline.isVisible())await decline.click()
     }else await page.waitForFunction(()=>document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim().split('/')[0]==='1')
    }
   }
   row.after=await publicState(page)
   if(blocked||scenario==='cancel')assert.deepEqual(row.after,row.before)
   else{
    assert.deepEqual(row.after.own.support.map(s=>s.rested),[true,true,true]);assert.equal(row.after.own.battle[0].rested,true)
    assert.deepEqual(row.after.own.battle.map(c=>c.hp),[4,2]);assert.deepEqual(row.after.foe.battle.map(c=>c.hp),scenario==='faint'?[2]:[1,2]);assert.equal(row.after.foe.trash-row.before.foe.trash,scenario==='faint'?1:3)
   }
   row.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
   if(!blocked&&scenario!=='cancel')assert.ok(row.trace.some(c=>c.commandKind==='declare-attack'))
   if(scenario==='cancel')assert.deepEqual(row.trace,[])
   assert.ok(!row.trace.some(c=>['activate-skill','resolve-attack-effect','resolve-flip'].includes(c.commandKind)))
   await page.getByTestId('battle-log-toggle').click()
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByTestId('battle-log-export-replay').click()])
   row.replay=`${output}/${scenario}-${viewport.width}-replay.json`;await download.saveAs(row.replay)
   const record=JSON.parse(await readFile(row.replay,'utf8'))
   for(const player of Object.values(record.finalState.players)){
    const cards=[...player.deck,...player.hand,...player.discardPile,...player.breakArea,...player.supportArea.map(s=>s.card),...player.battleArea.flatMap(c=>[c.card,...c.hpCards])]
    assert.equal(cards.length,60);assert.equal(new Set(cards.map(c=>c.instanceId)).size,60)
    const counts=new Map();for(const card of cards)counts.set(card.id,(counts.get(card.id)??0)+1);assert.ok([...counts.values()].every(n=>n<=4))
   }
   if(scenario==='faint')assert.deepEqual(record.finalState.players['player-two'].breakArea.map(c=>c.id),['BS6-017'])
   assert.deepEqual(errors,[]);row.status='PASS'
  }catch(error){row.error=String(error.stack??error);row.body=await page.locator('body').innerText();throw error}
  finally{row.errors=errors;rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{await writeFile(output+'/results.json',JSON.stringify(rows,null,2));await browser?.close();server.kill()}
console.log(`PASS ${rows.length} ST7-009 original-printing Chrome cases`)
