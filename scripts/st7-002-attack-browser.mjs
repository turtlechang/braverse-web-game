import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const port=4249,output=process.env.ST7002_OUTPUT??'output/st6-st10/st7-002-attack-browser-formal',rows=[]
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir','dist','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of ['positive','cancel','no-energy','wrong-color','rested']){
  const page=await browser.newPage({viewport}),errors=[],row={scenario,viewport,status:'FAIL'}
  page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.route(`http://127.0.0.1:${port}/favicon.ico`,async r=>r.fulfill({contentType:'image/png',body:await readFile('public/card-back.png')}))
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST7-002:mango-attack-${scenario}`)
   await page.locator('.bottom-field').waitFor();await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const source=page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="player-one-ST7-002-1"]')
   await source.locator('img').first().evaluate(img=>img.decode())
   assert.ok((await source.locator('img').first().getAttribute('src')).includes('cruDcKPPokLdXp97wS57jA'))
   await page.getByRole('button',{name:'略過整個登場效果',exact:true}).click()
   await page.waitForFunction(()=>!document.querySelector('.effect-panel:not(.is-complete)'))
   if(['no-energy','wrong-color','rested'].includes(scenario))assert.equal(await source.locator('.card-face.is-attackable').count(),0)
   else{
    await source.locator('.card-face.is-attackable').click()
    await page.locator('.bottom-field .support-card-wrap .card-face').nth(0).click()
    await page.screenshot({path:`${output}/${scenario}-${viewport.width}-payment.png`,fullPage:true})
    if(scenario==='cancel')await page.getByRole('button',{name:'取消攻擊',exact:true}).click()
    else{await page.locator('.top-field .combat-card-wrap[data-card-instance-id="player-two-ST6-012-1"] .card-face[aria-label^="選擇攻擊目標："]').click();await page.waitForFunction(()=>document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="player-two-ST6-012-1"] .badge-hp')?.textContent.trim()==='1/2')}
   }
   await page.getByTestId('battle-log-toggle').click()
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByTestId('battle-log-export-replay').click()])
   const path=`${output}/${scenario}-${viewport.width}-replay.json`;await download.saveAs(path)
   const replay=JSON.parse(await readFile(path,'utf8')),own=replay.finalState.players['player-one'],foe=replay.finalState.players['player-two']
   assert.equal(own.battleArea.find(c=>c.card.id==='ST7-002').hpCards.length,2)
   if(scenario==='positive'){
    assert.equal(foe.battleArea[0].hpCards.length,1);assert.equal(foe.discardPile.length,1)
    assert.equal(own.supportArea.filter(c=>c.rested).length,1);assert.equal(own.battleArea.find(c=>c.card.id==='ST7-002').rested,true)
    const command=replay.commands.find(c=>c.kind==='declare-attack');assert.ok(command);assert.deepEqual(command.supportPaymentIds,['player-one-ST2-020-1'])
   }else{assert.deepEqual(own,replay.initialState.players['player-one']);assert.deepEqual(foe,replay.initialState.players['player-two']);assert.equal(replay.commands.filter(c=>c.kind==='declare-attack').length,0)}
   assert.deepEqual(errors,[]);row.status='PASS';row.replay=path
  }catch(e){row.error=String(e);throw e}finally{rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{if(browser)await browser.close();server.kill();await writeFile(output+'/results.json',JSON.stringify({scope:'Actual-source ST7-002 original Y ordinary 1 actual UI payment/cancel/blocked attack matrix; prepared local, not full-match/online/promotion.',rows},null,2))}
console.log(`PASS ${rows.length} ST7-002 original ordinary-attack Chrome cases`)
