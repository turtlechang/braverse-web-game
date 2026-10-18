import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_TRAP_AI_OUTPUT??'output/ai-cookierift/protective-trap-browser'
const port=4221,rows=[]
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<50;i++){
  try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{}
  await new Promise(resolve=>setTimeout(resolve,100))
 }
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of ['saving','nonlethal','no-energy']){
  const page=await browser.newPage({viewport}),errors=[],row={scenario,viewport,status:'FAIL'}
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message))
  try{
   await page.goto(`http://127.0.0.1:${port}/?test-state=ai-trap-target:${scenario}`,{waitUntil:'networkidle'})
   const target=page.locator('.top-field .combat-card-wrap[data-card-instance-id="player-two-ST3-005-1"]')
   if(scenario==='no-energy')await target.waitFor({state:'detached'})
   else{
    await page.waitForFunction(()=>document.querySelectorAll('.top-field .support-card-wrap').length===1)
    await page.waitForFunction(expected=>Number.parseInt(document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="player-two-ST3-005-1"] .badge-hp')?.textContent ?? '',10)===expected,scenario==='saving'?2:1)
    const art=target.locator('img[alt="Blackberry Cookie"]').first()
    await art.waitFor()
    await art.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Original card art failed'))}))
    assert.match(await art.getAttribute('src'),/cookierunbraverse.com\/data\/en_storage\//)
   }
   await page.getByTestId('battle-log-toggle').click()
   let replay
   for(let attempt=0;attempt<8;attempt++){
    const event=page.waitForEvent('download')
    await page.getByTestId('battle-log-export-replay').click()
    const download=await event,path=`${output}/${scenario}-${viewport.width}-replay-${attempt}.json`
    await download.saveAs(path);replay=JSON.parse(await readFile(path,'utf8'))
    if(replay.commands.some(c=>c.kind==='resolve-battle'&&c.playerId==='player-one'))break
    await page.waitForTimeout(300)
   }
   assert.ok(replay.commands.some(c=>c.kind==='resolve-battle'&&c.playerId==='player-one'))
   const declaration=replay.commands.find(c=>c.kind==='declare-attack')
   assert.equal(declaration.playerId,'player-one')
   assert.equal(declaration.attackerInstanceId,scenario==='nonlethal'?'player-one-BS12-042-1':'player-one-ST3-011-1')
   assert.equal(declaration.targetInstanceId,'player-two-ST3-005-1')
   assert.equal(declaration.supportPaymentIds.length,scenario==='nonlethal'?1:2)
   assert.equal(replay.finalState.pendingBattle,null)
   const trap=replay.commands.find(c=>c.kind==='play-trap')
   const self=replay.finalState.players['player-two']
   if(scenario==='no-energy'){
    assert.equal(trap,undefined)
    assert.ok(replay.commands.some(c=>c.kind==='skip-trap'&&c.playerId==='player-two'))
    assert.equal(self.battleArea.some(c=>c.card.id==='ST3-005'),false)
    assert.equal(self.supportArea.length,2)
   }else{
    assert.equal(trap.playerId,'player-two');assert.equal(trap.trapInstanceId,'player-two-ST3-019-1')
    assert.equal(trap.paymentIds.length,1);assert.equal(trap.supportTrashIds.length,1)
    assert.deepEqual(trap.targetIds,[scenario==='saving'?declaration.attackerInstanceId:'player-one-BS12-059-1'])
    assert.equal(self.battleArea.find(c=>c.card.id==='ST3-005').hpCards.length,scenario==='saving'?2:1)
    assert.equal(self.supportArea.length,1)
   }
   assert.equal(replay.ai.agents['player-two'].aiLevel,5)
   assert.equal(errors.length,0,errors.join('\n'))
   row.commands=replay.commands;row.ai=replay.ai;row.status='PASS'
  }catch(error){row.error=String(error);throw error}
  finally{rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{if(browser)await browser.close();server.kill();await writeFile(`${output}/results.json`,JSON.stringify({scope:'Local formal registry, actual AI decisions and exported commands at two viewports; not online acceptance.',rows},null,2))}
console.log(`PASS ${rows.length} protective trap AI Browser cases`)
