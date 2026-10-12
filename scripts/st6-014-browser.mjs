import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_ST6014_OUTPUT??'output/st6-st10/st6-014-browser-formal'
await mkdir(output,{recursive:true})
const port=4232,rows=[]
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',process.env.BRAVERSE_ST6014_DIST??'dist'],{stdio:'ignore'})
const snapshot=page=>page.evaluate(()=>{
 const side=name=>{const field=document.querySelector(`.${name}-field`);return {
  battle:[...field.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:c.querySelector('.badge-hp').textContent.trim(),attack:Number(c.querySelector('.badge-atk').textContent.match(/\d+/)[0]),rested:c.querySelector('.card-face').classList.contains('is-rested')})),
  support:[...field.querySelectorAll('.support-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),rested:c.querySelector('.card-face').classList.contains('is-rested')})),
  trash:Number(field.querySelector('.discard-zone.resource-summary > strong')?.textContent),
  deck:Number(field.querySelector('.deck-zone .resource-summary > strong')?.textContent),
 }}
 return {own:side('bottom'),foe:side('top'),hand:document.querySelectorAll('.bottom-hand .hand-card-wrap').length}
})
let browser
const cases=['positive','cost-fire','zero-target','low','last-hp','no-target','rested-source','negative','wrong-color','wrong-phase','cancel-payment','missing-hp','expiry','attack','target-faints','reveal']
try{
 for(let i=0;i<60;i++){
  try{if((await fetch('http://127.0.0.1:'+port)).ok)break}catch{/* preview startup */}
  await new Promise(r=>setTimeout(r,100))
 }
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[],httpErrors:[]}
  page.setDefaultTimeout(10000)
  page.on('pageerror',e=>row.errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error')row.errors.push({text:m.text(),location:m.location()})})
  page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()})})
  try{
   await page.route('http://127.0.0.1:'+port+'/favicon.ico',async route=>route.fulfill({contentType:'image/png',body:await readFile('public/card-back.png')}))
   const route=scenario==='last-hp'?'low':['positive','low','no-target','rested-source','attack','negative','wrong-color','wrong-phase','target-faints','reveal'].includes(scenario)?scenario:'positive'
   await page.goto('http://127.0.0.1:'+port+'/?test-state=deck-addition:ST6-014:'+route+'&contract-card=ST6-014')
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const hand=page.locator('.bottom-hand .hand-card-wrap').filter({has:page.locator('img[alt="Essence of Conflagration"]')})
   const art=hand.locator('img').first();await art.evaluate(img=>img.decode())
   assert.match(await art.getAttribute('src'),/iVEAlWYp73lZxq5ql6kG2g\.webp/)
   row.before=await snapshot(page)
   assert.equal(row.before.hand,1)
   await hand.locator('button.card-face').click()
   if(['negative','wrong-color','wrong-phase'].includes(scenario)){
    assert.equal(await hand.getByRole('button',{name:'使用',exact:true}).count(),0)
    assert.deepEqual(await snapshot(page),row.before)
    const details=page.getByRole('dialog',{name:'Essence of Conflagration 卡牌詳情',exact:true})
    if(await details.count())await details.locator('.close-modal').click()
   }else{
    await hand.getByRole('button',{name:'使用',exact:true}).click()
    const panel=page.locator('.effect-panel:not(.is-complete):visible')
    await panel.waitFor()
    const payments=panel.locator('.effect-candidates-payment button:not([disabled])')
    assert.equal(await payments.count(),scenario==='rested-source'?2:scenario==='attack'?4:3)
    await payments.nth(0).click();await payments.nth(1).click()
    const next=panel.getByRole('button',{name:'下一步',exact:true})
    if(await next.count())await next.click()
    const hp=panel.locator('.effect-candidates-hp-cost button')
    assert.equal(await hp.count(),2,'All own Cookies are valid HP sources')
    assert.equal(await panel.locator('.effect-cost-resolution-card').count(),0,'HP identities stay hidden before payment')
    assert.equal(await panel.getByRole('button',{name:'確認發動',exact:true}).isEnabled(),false)
    if(scenario!=='missing-hp')await hp.nth(['cost-fire','last-hp'].includes(scenario)?1:0).click()
    await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-payment.png',fullPage:true})
    if(['cancel-payment','missing-hp'].includes(scenario)){
     if(scenario==='missing-hp')assert.equal(await panel.getByRole('button',{name:'確認發動',exact:true}).isEnabled(),false)
     await panel.getByRole('button',{name:'取消技能',exact:true}).click()
     assert.deepEqual(await snapshot(page),row.before)
    }else{
     await panel.getByRole('button',{name:'確認發動',exact:true}).click()
     await panel.waitFor()
     // The all-opponent damage stage has no optional Cookie selector.
     if(await panel.locator('.effect-candidates-target button').count()===0 &&
        !/Fire Spirit Cookie/.test(await panel.innerText())){
      await panel.getByRole('button',{name:'確認發動',exact:true}).click()
     }
     await panel.waitFor()
     if(['target-faints','reveal'].includes(scenario))
      await page.waitForFunction(()=>document.querySelectorAll('.effect-panel:not(.is-complete) .effect-candidates-target button').length===1)
     const targets=panel.locator('.effect-candidates-target button')
     const zero=['zero-target','no-target','last-hp'].includes(scenario)
     assert.equal(await targets.count(),['no-target','last-hp'].includes(scenario)?0:1)
     if(!zero)await targets.filter({hasText:'Fire Spirit Cookie'}).click()
     assert.equal(await panel.getByRole('button',{name:'取消技能',exact:true}).count(),0)
     await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-target.png',fullPage:true})
     await panel.getByRole('button',{name:'確認發動',exact:true}).click()
     await page.waitForFunction(()=>!document.querySelector('.effect-panel:not(.is-complete)'))
     const replenish=page.getByRole('button',{name:'不補餅乾',exact:true})
     if(await replenish.count())await replenish.click()
     row.settled=await snapshot(page)
     assert.equal(row.settled.hand,0)
     assert.equal(row.settled.own.trash,row.before.own.trash+2)
     assert.equal(row.settled.own.deck,row.before.own.deck)
     assert.equal(row.settled.own.support.filter(s=>s.rested).length,row.before.own.support.filter(s=>s.rested).length+2)
     const costIndex=['cost-fire','last-hp'].includes(scenario)?1:0
     for(const [i,before] of row.before.own.battle.entries()){
      const after=row.settled.own.battle.find(c=>c.id===before.id),hp=Number(before.hp.split('/')[0])
      if(scenario==='last-hp'&&i===1){assert.equal(after,undefined);continue}
      assert.deepEqual(after,{...before,hp:i===costIndex?(hp-1)+'/'+before.hp.split('/')[1]:before.hp,attack:before.attack+(!zero&&i===1?1:0)})
     }
     row.settled.foe.battle.forEach((c,i)=>assert.deepEqual(c,{...row.before.foe.battle[i],hp:(Number(row.before.foe.battle[i].hp.split('/')[0])-1)+'/'+row.before.foe.battle[i].hp.split('/')[1]}))
     assert.equal(row.settled.foe.battle.length,['target-faints','reveal'].includes(scenario)?1:2);assert.deepEqual(row.settled.foe.support,row.before.foe.support)
     if(scenario==='expiry'){
      await page.getByRole('button',{name:'結束主要階段',exact:true}).click()
      await page.getByRole('button',{name:'結束回合',exact:true}).click()
      await page.waitForFunction(()=>document.querySelectorAll('.bottom-field .badge-atk')[1]?.textContent.trim()==='1')
      assert.equal((await snapshot(page)).own.battle[1].attack,1)
     }
     if(scenario==='attack'){
      await page.locator('.bottom-field .combat-card-wrap').nth(1).locator('.card-face.is-attackable').click()
      await page.locator('.bottom-field .support-card-wrap').nth(2).locator('.card-face').click();await page.locator('.bottom-field .support-card-wrap').nth(3).locator('.card-face').click()
      await page.locator('.top-field .combat-card-wrap').filter({has:page.locator('img[alt="Sour Belt Cookie"]')}).locator('.card-face[aria-label^="選擇攻擊目標："]').click()
      await page.waitForFunction(()=>document.querySelectorAll('.top-field .combat-card-wrap .badge-hp')[1]?.textContent.trim()==='1/4')
      await page.getByRole('button',{name:'略過',exact:true}).click()
     }
    }
   }
   row.after=await snapshot(page)
   await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-result.png',fullPage:true})
   await page.getByTestId('battle-log-toggle').click()
   const downloadEvent=page.waitForEvent('download')
   await page.getByTestId('battle-log-export-replay').click()
   const download=await downloadEvent
   await download.saveAs(output+'/'+scenario+'-'+viewport.width+'-replay.json')
   row.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
   if(!['negative','wrong-color','wrong-phase','cancel-payment','missing-hp'].includes(scenario)){
    assert.ok(row.trace.some(e=>e.commandKind==='begin-play-item'))
    assert.ok(row.trace.some(e=>e.commandKind==='resolve-ability-effect'))
   }
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.httpErrors,[]);row.status='PASS'
   console.log('PASS ST6-014 '+scenario+' '+viewport.width+'x'+viewport.height)
  }catch(error){
   row.error=error.stack;row.dom=(await page.locator('body').innerText()).slice(0,16000)
   await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-FAIL.png',fullPage:true})
   throw error
  }finally{
   rows.push(row);await writeFile(output+'/results.json',JSON.stringify(rows,null,2));await page.close()
  }
 }
}finally{await browser?.close();server.kill()}
