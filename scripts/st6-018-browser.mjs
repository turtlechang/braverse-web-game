import {createHash} from 'node:crypto'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.ST6018_BROWSER_OUTPUT??'output/st6-st10/st6-018-browser-formal',port=4240,rows=[]
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',process.env.ST6018_BROWSER_DIST??'dist'],{stdio:'ignore'})
let browser
const cases=['positive','rested-target','other','zero','negative','wrong-color','main','wrong-phase','one-red','cancel-payment','cancel-target','payment-deselect','target-deselect','expiry']
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of (process.env.ST6018_BROWSER_CASES?.split(',')??cases)){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[]};page.setDefaultTimeout(10000)
  page.on('pageerror',e=>row.errors.push(e.message))
  try{
   const route=['cancel-payment','cancel-target','payment-deselect','target-deselect','expiry'].includes(scenario)?'positive':scenario
   if(process.env.ST6018_ORIGINAL_ART_CACHE){
    const bytes=await readFile(process.env.ST6018_ORIGINAL_ART_CACHE)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),'2ce6abd7df8a6c998188666c18fc6b953744eb53b10c7aa4db468a7c80123fb7')
    await page.route('https://cookierunbraverse.com/data/en_storage/fxYCDp_bETqoRMAGyI2XHg.webp',r=>r.fulfill({contentType:'image/webp',body:bytes}))
   }
   await page.goto('http://127.0.0.1:'+port+'/?test-state=deck-addition:ST6-018:'+route+'&contract-card=ST6-018')
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const modal=page.locator('.trap-response-modal:visible'),blocked=['negative','wrong-color','main','wrong-phase'].includes(scenario)
   if(blocked){assert.equal(await modal.count(),0)}else{
    await modal.waitFor()
    const trap=modal.locator('.modal-card-options > button').filter({hasText:'Frozen Flame'})
    await trap.locator('img').first().evaluate(img=>img.decode())
    assert.match(await trap.locator('img').first().getAttribute('src'),/fxYCDp_bETqoRMAGyI2XHg/)
    await trap.click()
    if(scenario==='cancel-payment')await modal.getByRole('button',{name:'不發動',exact:true}).click()
    else{
     const payments=modal.locator('.trap-guided-section .trap-discard-options > button'),next=modal.getByRole('button',{name:'下一步',exact:true})
     assert.equal(await payments.count(),scenario==='one-red'?1:3);assert.equal(await next.isEnabled(),false)
     await payments.nth(0).click();assert.equal(await next.isEnabled(),true)
     if(scenario==='payment-deselect'){await payments.nth(0).click();assert.equal(await next.isEnabled(),false);await payments.nth(0).click()}
     await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-payment.png',fullPage:true})
     await next.click()
     assert.equal(await modal.locator('.trap-effect-target-step').count(),1)
     const targets=modal.locator('.trap-target-options > button'),confirm=modal.getByRole('button',{name:'確認發動',exact:true})
     assert.equal(await targets.count(),2);assert.equal(await confirm.isEnabled(),true)
     if(scenario!=='zero')await targets.filter({hasText:['other','rested-target'].includes(scenario)?'Picky Pyro-tiger':'Fire Spirit Cookie'}).click()
     if(scenario==='target-deselect'){await targets.filter({hasText:'Fire Spirit Cookie'}).click();assert.equal(await confirm.isEnabled(),true);await targets.filter({hasText:'Fire Spirit Cookie'}).click()}
     const bounds=await modal.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1)
     await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-target.png',fullPage:true})
     if(scenario==='cancel-target')await modal.getByRole('button',{name:'不發動',exact:true}).click();else await confirm.click()
    }
    await modal.waitFor({state:'hidden'})
   }
   const activated=!blocked&&!scenario.startsWith('cancel'),bonus=['positive','rested-witness','payment-deselect','target-deselect','expiry'].includes(scenario)
   const hp=['main','wrong-phase'].includes(scenario)?6:activated&&!['other','rested-target','zero'].includes(scenario)?3:2
   await page.waitForFunction(hp=>document.querySelectorAll('.bottom-field .combat-card-wrap .badge-hp')[1]?.textContent.trim()===hp+'/6',hp)
   if(scenario==='expiry')await page.getByRole('button',{name:'略過支援階段',exact:true}).click()
   await page.getByTestId('battle-log-toggle').click()
   const downloadPromise=page.waitForEvent('download');await page.getByTestId('battle-log-export-replay').click()
   const download=await downloadPromise,path=output+'/'+scenario+'-'+viewport.width+'-replay.json';await download.saveAs(path)
   const replay=JSON.parse(await readFile(path,'utf8')),traps=replay.commands.filter(c=>c.kind==='play-trap')
   assert.equal(traps.length,activated?1:0)
   if(activated){const trap=traps[0];assert.equal(trap.paymentIds.length,1);assert.equal(trap.playerId,'player-one');assert.deepEqual(trap.effectTargets,[scenario==='zero'?[]:[replay.initialState.players['player-one'].battleArea[['other','rested-target'].includes(scenario)?0:1].card.instanceId]])}
   assert.equal(replay.finalState.players['player-one'].battleArea[1].hpCards.length,hp)
   if(scenario==='expiry'){assert.ok(replay.finalState.turnNumber>replay.initialState.turnNumber);assert.deepEqual(replay.finalState.damageReceivedModifiers,[])}
   assert.equal(replay.finalState.attackModifiers.length,0);assert.equal(row.errors.length,0,row.errors.join('\n'));row.status='PASS';row.commands=replay.commands
  }catch(error){row.error=String(error);throw error}
  finally{rows.push(row);await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-'+row.status+'.png',fullPage:true});await page.close()}
 }
}finally{if(browser)await browser.close();server.kill();await writeFile(output+'/results.json',JSON.stringify({scope:'Formal registry original-card prepared test-state, local actual Chrome at two viewports; not deck-start full-match or online acceptance',rows},null,2))}
console.log('PASS '+rows.length+' actual Chrome ST6-018 cases')
