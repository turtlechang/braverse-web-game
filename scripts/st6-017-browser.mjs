import {createHash} from 'node:crypto'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.ST6017_BROWSER_OUTPUT??'output/st6-st10/st6-017-browser-formal',port=4238,rows=[]
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',process.env.ST6017_BROWSER_DIST??'dist'],{stdio:'ignore'})
let browser
const cases=['positive','false','rested-witness','hand-witness','trash-witness','break-witness','support-witness','opponent-witness','zero','other','cancel-payment','cancel-target','payment-deselect','target-deselect','negative','wrong-color','one-red','main','wrong-phase','expiry']
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of (process.env.ST6017_BROWSER_CASES?.split(',')??cases)){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[]};page.setDefaultTimeout(10000)
  page.on('pageerror',e=>row.errors.push(e.message))
  try{
   const route=['cancel-payment','cancel-target','payment-deselect','target-deselect','expiry'].includes(scenario)?'positive':scenario
   if(process.env.ST6017_ORIGINAL_ART_CACHE){
    const bytes=await readFile(process.env.ST6017_ORIGINAL_ART_CACHE)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),'4e8f4d9993f7ded861d10875d5b39b0d1a031128f00fa6590aa20fb6300e530d')
    await page.route('https://cookierunbraverse.com/data/en_storage/3DVRSJPAtr_rOnrJnmQ3Ng.webp',r=>r.fulfill({contentType:'image/webp',body:bytes}))
   }
   await page.goto('http://127.0.0.1:'+port+'/?test-state=deck-addition:ST6-017:'+route+'&contract-card=ST6-017')
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const modal=page.locator('.trap-response-modal:visible'),blocked=['negative','wrong-color','one-red','main','wrong-phase'].includes(scenario)
   if(blocked){assert.equal(await modal.count(),0)}else{
    await modal.waitFor()
    const trap=modal.locator('.modal-card-options > button').filter({hasText:'Restored Power of Fire'})
    await trap.locator('img').first().evaluate(img=>img.decode())
    assert.match(await trap.locator('img').first().getAttribute('src'),/3DVRSJPAtr_rOnrJnmQ3Ng/)
    await trap.click()
    if(scenario==='cancel-payment')await modal.getByRole('button',{name:'不發動',exact:true}).click()
    else{
     const payments=modal.locator('.trap-guided-section .trap-discard-options > button'),next=modal.getByRole('button',{name:'下一步',exact:true})
     assert.equal(await payments.count(),scenario==='support-witness'?4:3);assert.equal(await next.isEnabled(),false)
     await payments.nth(0).click();assert.equal(await next.isEnabled(),false);await payments.nth(1).click()
     if(scenario==='payment-deselect'){await payments.nth(0).click();assert.equal(await next.isEnabled(),false);await payments.nth(0).click()}
     await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-payment.png',fullPage:true})
     await next.click()
     assert.equal(await modal.locator('.trap-effect-target-step').count(),1)
     const targets=modal.locator('.trap-effect-target-step .trap-target-options > button'),confirm=modal.getByRole('button',{name:'確認發動',exact:true})
     assert.equal(await targets.count(),2);assert.equal(await confirm.isEnabled(),true)
     if(scenario!=='zero')await targets.filter({hasText:scenario==='other'?'Fire Spirit Cookie':'Sour Belt Cookie'}).click()
     if(scenario==='target-deselect'){await targets.filter({hasText:'Sour Belt Cookie'}).click();assert.equal(await confirm.isEnabled(),true);await targets.filter({hasText:'Sour Belt Cookie'}).click()}
     const bounds=await modal.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1)
     await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-target.png',fullPage:true})
     if(scenario==='cancel-target')await modal.getByRole('button',{name:'不發動',exact:true}).click();else await confirm.click()
    }
    await modal.waitFor({state:'hidden'})
   }
   const activated=!blocked&&!scenario.startsWith('cancel'),bonus=['positive','rested-witness','payment-deselect','target-deselect','expiry'].includes(scenario)
   const hp=['main','wrong-phase'].includes(scenario)?6:activated&&scenario!=='other'&&scenario!=='zero'?(bonus?5:4):2
   await page.waitForFunction(hp=>document.querySelectorAll('.bottom-field .combat-card-wrap .badge-hp')[1]?.textContent.trim()===hp+'/6',hp)
   if(scenario==='expiry')await page.getByRole('button',{name:'略過支援階段',exact:true}).click()
   await page.getByTestId('battle-log-toggle').click()
   const downloadPromise=page.waitForEvent('download');await page.getByTestId('battle-log-export-replay').click()
   const download=await downloadPromise,path=output+'/'+scenario+'-'+viewport.width+'-replay.json';await download.saveAs(path)
   const replay=JSON.parse(await readFile(path,'utf8')),traps=replay.commands.filter(c=>c.kind==='play-trap')
   assert.equal(traps.length,activated?1:0)
   if(activated){const trap=traps[0];assert.equal(trap.paymentIds.length,2);assert.equal(trap.playerId,'player-one');assert.deepEqual(trap.effectTargets,[scenario==='zero'?[]:[replay.initialState.players['player-two'].battleArea[scenario==='other'?0:1].card.instanceId]])}
   assert.equal(replay.finalState.players['player-one'].battleArea[1].hpCards.length,hp)
   if(scenario==='expiry'){assert.ok(replay.finalState.turnNumber>replay.initialState.turnNumber);assert.deepEqual(replay.finalState.attackModifiers,[])}
   assert.equal(row.errors.length,0,row.errors.join('\n'));row.status='PASS';row.commands=replay.commands
  }catch(error){row.error=String(error);throw error}
  finally{rows.push(row);await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-'+row.status+'.png',fullPage:true});await page.close()}
 }
}finally{if(browser)await browser.close();server.kill();await writeFile(output+'/results.json',JSON.stringify({scope:'Output-only original-card preview, local actual Chrome two viewports, not formal or online acceptance',rows},null,2))}
console.log('PASS '+rows.length+' actual Chrome ST6-017 cases')
