import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_ST6011_OUTPUT??'output/st6-st10/st6-011-browser-candidate'
const preview=process.env.BRAVERSE_ST6011_PREVIEW_DIR??'dist'
const port=4227
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',preview],{stdio:'ignore'})
let browser
const rows=[]
const snapshot=page=>page.evaluate(()=>{
 const side=name=>{
  const field=document.querySelector(`.${name}-field`)
  return {
   battle:[...field.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:c.querySelector('.badge-hp').textContent.trim(),rested:c.querySelector('.card-face').classList.contains('is-rested')})),
   support:[...field.querySelectorAll('.support-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),rested:c.querySelector('.card-face').classList.contains('is-rested')})),
   trash:Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
  }
 }
 return {own:side('bottom'),foe:side('top'),hand:document.querySelectorAll('.bottom-hand .hand-card-wrap').length}
})
const trace=page=>page.evaluate(()=>window.__braverseContractTrace??[])
const colors=['red','yellow','green','blue','purple','black']
const cases=[...colors.map(c=>'pay-'+c),'low','attack-cancel','negative','wrong-phase','rested-source','reveal']
try{
 for(let attempt=0;attempt<40;attempt++){
  try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{/* startup */}
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),errors=[],row={viewport,scenario,status:'FAIL'}
  page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message))
  try{
   const route=scenario.startsWith('pay-')||scenario==='attack-cancel'?'positive':scenario
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-011:${route}&contract-card=ST6-011`)
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const source=page.locator('.bottom-field .combat-card-wrap').filter({has:page.locator('img[alt="Habanero Cookie"]')})
   const image=source.locator('img').first()
   await image.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Original Habanero printing unavailable'))}))
   assert.match(await image.getAttribute('src'),/cookierunbraverse.com\/data\/en_storage\//)
   assert.equal(await source.locator('.skill-action:enabled').count(),0)
   row.before=await snapshot(page);row.beforeTrace=await trace(page)
   const attackCase=scenario.startsWith('pay-')||scenario==='low'||scenario==='attack-cancel'
   if(attackCase){
    assert.equal(row.before.own.battle[0].hp,'2/2')
    await source.locator('.card-face.is-attackable').click()
    const index=scenario==='low'?3:scenario==='attack-cancel'?0:colors.indexOf(scenario.slice(4))
    await page.locator('.bottom-field .support-card-wrap .card-face').nth(index).click()
    assert.match(await page.getByTestId('attack-payment-panel').innerText(),/已選 1／1/)
    await page.screenshot({path:`${output}/${scenario}-${viewport.width}-payment.png`,fullPage:true})
    if(scenario==='attack-cancel')await page.getByRole('button',{name:'取消攻擊',exact:true}).click()
    else{
     await page.locator('.top-field .combat-card-wrap .card-face[aria-label^="選擇攻擊目標："]').first().click()
     if(scenario==='low'){
      await page.locator('.top-field .combat-card-wrap img[alt="Sour Belt Cookie"]').waitFor({state:'hidden'})
      const skip=page.getByRole('button',{name:'不補餅乾',exact:true})
      if(await skip.isVisible())await skip.click()
     }else await page.waitForFunction(()=>document.querySelector('.top-field .combat-card-wrap .badge-hp')?.textContent.trim()==='3/4')
     await page.waitForFunction(()=>document.querySelector('.next-phase-button')?.disabled===false)
     row.after=await snapshot(page)
     assert.equal(row.after.own.battle[0].hp,'2/2');assert.equal(row.after.own.battle[0].rested,true)
     assert.deepEqual(row.after.own.battle.slice(1),row.before.own.battle.slice(1))
     assert.equal(row.after.own.support.filter(s=>s.rested).length,row.before.own.support.filter(s=>s.rested).length+1)
     assert.equal(row.after.own.support[index].rested,true)
     assert.equal(row.after.hand,row.before.hand)
     assert.deepEqual(row.after.foe.battle.map(c=>c.hp),scenario==='low'?['3/3']:['3/4','3/3'])
     await page.getByTestId('battle-log-toggle').click()
     const event=page.waitForEvent('download')
     await page.getByTestId('battle-log-export-replay').click()
     const download=await event,path=`${output}/${scenario}-${viewport.width}-replay.json`
     await download.saveAs(path)
     const replay=JSON.parse(await readFile(path,'utf8'))
     const command=replay.commands.filter(c=>c.kind==='declare-attack'&&c.attackerInstanceId===row.before.own.battle[0].id).at(-1)
     assert.deepEqual(command.supportPaymentIds,[row.before.own.support[index].id])
     assert.equal(command.targetInstanceId,row.before.foe.battle[0].id)
     assert.ok(replay.commands.some(c=>c.kind==='resolve-battle'))
     if(scenario==='low')assert.ok(replay.commands.some(c=>c.kind==='skip-replacement'&&c.playerId==='player-two'))
    }
   }else if(scenario==='reveal'){
    await page.waitForFunction(()=>document.querySelector('.bottom-field .combat-card-wrap .badge-hp')?.textContent.trim()==='1/2')
    assert.equal(await page.locator('.flip-response-modal:visible').count(),0)
    row.after=await snapshot(page)
    assert.equal(row.after.own.trash,1)
    row.trace=await trace(page)
    assert.ok(!row.trace.some(entry=>entry.commandKind.includes('flip')))
    // The card-scoped trace can be empty for a vanilla HP card. Read the
    // real parent commands from the exported replay rather than inventing a trace.
    await page.getByTestId('battle-log-toggle').click()
    const event=page.waitForEvent('download')
    await page.getByTestId('battle-log-export-replay').click()
    const download=await event,path=`${output}/reveal-${viewport.width}-replay.json`
    await download.saveAs(path)
    const replay=JSON.parse(await readFile(path,'utf8'))
    assert.deepEqual(replay.commands.map(command=>command.kind),['declare-attack','skip-trap','resolve-battle'])
    assert.equal(replay.commands[0].playerId,'player-two')
    assert.equal(replay.commands[0].targetInstanceId,row.before.own.battle[0].id)
    assert.equal(replay.finalState.pendingBattle,null)
    assert.equal(replay.initialState.players['player-one'].battleArea[0].hpCards.length,2)
    assert.equal(replay.finalState.players['player-one'].battleArea[0].hpCards.length,1)
    assert.ok(replay.finalState.players['player-one'].discardPile.some(card=>card.id==='ST6-011'))
    row.legalNoOpReason='Original Habanero has no FLIP; real Leek attack reveals it, HP2→1, card discarded, parent battle finished without FLIP commands.'
   }else assert.equal(await source.locator('.card-face.is-attackable').count(),0)
   row.after??=await snapshot(page);row.trace??=await trace(page)
   if(['attack-cancel','negative','wrong-phase','rested-source'].includes(scenario))assert.deepEqual(row.after,row.before)
   if(attackCase&&scenario!=='attack-cancel')assert.equal(row.trace.filter(c=>c.commandKind==='declare-attack').length-row.beforeTrace.filter(c=>c.commandKind==='declare-attack').length,1)
   assert.deepEqual(errors,[])
   row.status='PASS'
  }catch(error){row.error=String(error.stack??error);row.body=await page.locator('body').innerText();throw error}
  finally{rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{await writeFile(`${output}/results.json`,JSON.stringify(rows,null,2));await browser?.close();server.kill()}
console.log(`PASS ${rows.length} original-printing ST6-011 Chrome cases; candidate-only preview`)
