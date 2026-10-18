import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_ST6015_OUTPUT??'output/st6-st10/st6-015-browser-formal'
await mkdir(output,{recursive:true})
const port=4234,rows=[]
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',process.env.BRAVERSE_ST6015_DIST??'dist'],{stdio:'ignore'})
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
const title="Fire Spirit Cookie's Staff"
const cases=['positive','same-cookie','other-cookie','zero-target','low','last-hp','rested-source','name-unrestricted','green-target','negative','wrong-color','wrong-phase','cancel-payment','missing-hp','expiry','attack']
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break}catch{/* startup */}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[],httpErrors:[]}
  page.setDefaultTimeout(10000)
  page.on('pageerror',e=>row.errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error')row.errors.push({text:m.text(),location:m.location()})})
  page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()})})
  try{
   await page.route('http://127.0.0.1:'+port+'/favicon.ico',async route=>route.fulfill({contentType:'image/png',body:await readFile('public/card-back.png')}))
   const route=scenario==='last-hp'?'low':scenario==='name-unrestricted'?'no-target':scenario==='green-target'?'green-arena':['positive','low','rested-source','negative','wrong-color','wrong-phase','attack'].includes(scenario)?scenario:'positive'
   await page.goto('http://127.0.0.1:'+port+'/?test-state=deck-addition:ST6-015:'+route+'&contract-card=ST6-015')
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const hand=page.locator('.bottom-hand .hand-card-wrap').filter({has:page.getByRole('img',{name:title,exact:true})})
   const art=hand.locator('img').first();await art.evaluate(img=>img.decode())
   assert.match(await art.getAttribute('src'),/TI-kjhi00ZuCzelmtMWzGQ\.webp/)
   row.before=await snapshot(page)
   assert.equal(row.before.hand,1)
   await hand.locator('button.card-face').click()
   if(['negative','wrong-color','wrong-phase'].includes(scenario)){
    assert.equal(await hand.getByRole('button',{name:'使用',exact:true}).count(),0)
    assert.deepEqual(await snapshot(page),row.before)
    const details=page.getByRole('dialog',{name:title+' 卡牌詳情',exact:true})
    if(await details.count())await details.locator('.close-modal').click()
   }else{
    await hand.getByRole('button',{name:'使用',exact:true}).click()
    const panel=page.locator('.effect-panel:not(.is-complete):visible');await panel.waitFor()
    const payments=panel.locator('.effect-candidates-payment button:not([disabled])')
    assert.equal(await payments.count(),scenario==='rested-source'?2:scenario==='attack'?4:3)
    await payments.nth(0).click();await payments.nth(1).click()
    await panel.getByRole('button',{name:'下一步',exact:true}).click()
    const hp=panel.locator('.effect-candidates-hp-cost button')
    assert.equal(await hp.count(),2)
    assert.equal(await panel.locator('.effect-cost-resolution-card').count(),0)
    const costIndex=['other-cookie','last-hp'].includes(scenario)?1:0
    if(scenario!=='missing-hp')await hp.nth(costIndex).click()
    await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-payment.png',fullPage:true})
    if(['cancel-payment','missing-hp'].includes(scenario)){
     if(scenario==='missing-hp')assert.equal(await panel.getByRole('button',{name:'下一步',exact:true}).isEnabled(),false)
     await panel.getByRole('button',{name:'取消技能',exact:true}).click()
     assert.deepEqual(await snapshot(page),row.before)
    }else{
     await panel.getByRole('button',{name:'下一步',exact:true}).click()
     const targets=panel.locator('.effect-candidates-target button')
     assert.equal(await targets.count(),scenario==='last-hp'?1:2,'Targets must exclude a Cookie whose selected HP cost removes its last HP')
     const zero=scenario==='zero-target'
     const targetIndex=['same-cookie','other-cookie','last-hp','rested-source','expiry','attack'].includes(scenario)?0:1
     const targetName=targetIndex===0?'Picky Pyro-tiger':scenario==='green-target'?'Vampire Cookie':scenario==='name-unrestricted'?'Habanero Cookie':'Fire Spirit Cookie'
     if(!zero)await targets.filter({hasText:targetName}).click()
     await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-target.png',fullPage:true})
     await panel.getByRole('button',{name:'確認發動',exact:true}).click()
     await page.waitForFunction(()=>!document.querySelector('.effect-panel:not(.is-complete)'))
     const replenish=page.getByRole('button',{name:'不補餅乾',exact:true})
     if(await replenish.count())await replenish.click()
     row.settled=await snapshot(page)
     assert.deepEqual(row.settled.foe,row.before.foe)
     assert.equal(row.settled.hand,0)
     assert.equal(row.settled.own.trash,row.before.own.trash+2)
     assert.equal(row.settled.own.deck,row.before.own.deck)
     assert.equal(row.settled.own.support.filter(s=>s.rested).length,row.before.own.support.filter(s=>s.rested).length+2)
     for(const [i,before] of row.before.own.battle.entries()){
      const after=row.settled.own.battle.find(c=>c.id===before.id),hp=Number(before.hp.split('/')[0])
      if(scenario==='last-hp'&&i===1){assert.equal(after,undefined);continue}
      assert.deepEqual(after,{...before,hp:i===costIndex?(hp-1)+'/'+before.hp.split('/')[1]:before.hp,
       attack:before.attack+(!zero&&i===targetIndex?2:0)})
     }
     if(scenario==='expiry'){
      await page.getByRole('button',{name:'結束主要階段',exact:true}).click()
      await page.getByRole('button',{name:'結束回合',exact:true}).click()
      await page.waitForFunction(()=>document.querySelector('.bottom-field .badge-atk')?.textContent.trim()==='2')
     }
     if(scenario==='attack'){
      await page.locator('.bottom-field .combat-card-wrap').first().locator('.card-face.is-attackable').click()
      for(const index of [2,3])await page.locator('.bottom-field .support-card-wrap').nth(index).locator('.card-face').click()
      await page.locator('.top-field .combat-card-wrap').filter({has:page.getByRole('img',{name:'Sour Belt Cookie',exact:true})}).locator('.card-face[aria-label^="選擇攻擊目標："]').click()
      await page.waitForFunction(()=>document.querySelectorAll('.top-field .combat-card-wrap').length===1)
     }
    }
   }
   row.after=await snapshot(page)
   await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-result.png',fullPage:true})
   await page.getByTestId('battle-log-toggle').click()
   const downloadEvent=page.waitForEvent('download');await page.getByTestId('battle-log-export-replay').click()
   const download=await downloadEvent;await download.saveAs(output+'/'+scenario+'-'+viewport.width+'-replay.json')
   row.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
   if(!['negative','wrong-color','wrong-phase','cancel-payment','missing-hp'].includes(scenario)){
    assert.ok(row.trace.some(e=>e.commandKind==='begin-play-item'))
    assert.ok(row.trace.some(e=>e.commandKind==='resolve-ability-effect'))
   }
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.httpErrors,[]);row.status='PASS'
   console.log('PASS ST6-015 '+scenario+' '+viewport.width+'x'+viewport.height)
  }catch(error){
   row.error=error.stack;row.dom=(await page.locator('body').innerText()).slice(0,16000)
   await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-FAIL.png',fullPage:true});throw error
  }finally{rows.push(row);await writeFile(output+'/results.json',JSON.stringify(rows,null,2));await page.close()}
 }
}finally{await browser?.close();server.kill()}
