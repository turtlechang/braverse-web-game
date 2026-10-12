import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const port=4249,output=process.env.ST7002_OUTPUT??'output/st6-st10/st7-002-browser-formal',rows=[]
const cases=(process.env.ST7002_CASES??'positive,mango-below,mango-above,no-supports,mango-rested,mango-skip,choux-positive,choux-below,choux-above,choux-zero,choux-other,choux-skip,choux-no-energy,coffee-positive,coffee-below,coffee-above,coffee-no-energy,coffee-skip').split(',')
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--outDir','dist','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<60;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),errors=[],row={scenario,viewport,status:'FAIL'}
  page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.route(`http://127.0.0.1:${port}/favicon.ico`,async route=>route.fulfill({contentType:'image/png',body:await readFile('public/card-back.png')}))
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST7-002:${scenario}`)
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const choux=scenario.startsWith('choux-'),coffee=scenario.startsWith('coffee-'),id=coffee?'BS6-078':choux?'BS4-033':'ST7-002',hp=coffee?3:choux?4:2
   const source=page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="player-one-${id}-1"]`)
   const art=source.locator('img').first();await art.evaluate(img=>img.decode())
   const expectedArt=coffee?'1qV5cwcp6GcNCfLiprNfpg':choux?'1lgwKH9eUldT5oOAkFKhxQ':'cruDcKPPokLdXp97wS57jA'
   assert.ok((await art.getAttribute('src')).includes(expectedArt))
   assert.equal((await source.locator('.badge-hp').innerText()).trim(),`${hp}/${hp}`)
   const blocked=scenario==='mango-below'||scenario==='choux-below'||scenario==='coffee-above'||scenario.endsWith('-no-energy')
   const skip=scenario.endsWith('-skip'),zero=scenario==='choux-zero'
   if(blocked){assert.equal(await page.locator('.effect-panel:not(.is-complete)').count(),0)}
   else{
    const panel=page.locator('.effect-panel:not(.is-complete)');await panel.waitFor()
    const box=await panel.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1)
    for(const img of await panel.locator('img').all())await img.evaluate(i=>i.decode())
    if(skip)await panel.getByRole('button',{name:'略過整個登場效果',exact:true}).click()
    else{
     if(choux||coffee){const payments=panel.locator('.effect-candidates-payment button');assert.equal(await payments.count(),choux?2:1);assert.equal(await panel.locator('.effect-panel-primary-action').isEnabled(),false);await payments.first().click();await page.screenshot({path:`${output}/${scenario}-${viewport.width}-payment.png`,fullPage:true})}
     if(choux){await panel.locator('.effect-panel-primary-action').click();const targets=panel.locator('.effect-candidates-target button');await targets.first().waitFor();assert.equal(await targets.count(),2);for(const target of await targets.all())if((await target.getAttribute('class')).includes('is-selected'))await target.click();if(!zero)await targets.filter({hasText:scenario==='choux-other'?'Fire Spirit Cookie':'Caramel Choux Cookie'}).click();await page.screenshot({path:`${output}/${scenario}-${viewport.width}-target.png`,fullPage:true})}
     await panel.locator('.effect-panel-primary-action').click()
    }
    await page.waitForFunction(()=>!document.querySelector('.effect-panel:not(.is-complete)'))
   }
   const gain=!blocked&&!skip&&!zero,other=scenario==='choux-other',sourceHp=hp+(gain&&!other?1:0)
   await page.waitForFunction(({selector,text})=>document.querySelector(selector)?.textContent.trim()===text,{selector:`.bottom-field .combat-card-wrap[data-card-instance-id="player-one-${id}-1"] .badge-hp`,text:`${sourceHp}/${hp}`})
   await page.getByTestId('battle-log-toggle').click()
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByTestId('battle-log-export-replay').click()])
   const path=`${output}/${scenario}-${viewport.width}-replay.json`;await download.saveAs(path)
   const replay=JSON.parse(await readFile(path,'utf8')),own=replay.finalState.players['player-one'],before=replay.initialState.players['player-one']
   const actualSource=own.battleArea.find(c=>c.card.id===id),otherCookie=own.battleArea.find(c=>c.card.id==='ST6-002')
   assert.equal(actualSource.hpCards.length,sourceHp);assert.equal(otherCookie.hpCards.length,6+(gain&&other?1:0));assert.equal(actualSource.rested,scenario==='mango-rested')
   assert.deepEqual(replay.finalState.players['player-two'],replay.initialState.players['player-two'])
   const paid=!blocked&&!skip&&(choux||coffee)?1:0
   assert.equal(own.supportArea.filter(c=>c.rested).length,before.supportArea.filter(c=>c.rested).length+paid)
   assert.equal(own.deck.length,before.deck.length-(gain?1:0));assert.deepEqual(own.hand,before.hand);assert.deepEqual(own.breakArea,before.breakArea);assert.deepEqual(own.discardPile,before.discardPile)
   assert.equal(replay.finalState.pendingOnPlay,null)
   if(blocked||skip)assert.deepEqual(own,before)
   else assert.ok(replay.commands.some(c=>['activate-skill','begin-activate-skill'].includes(c.kind)))
   for(const p of Object.values(replay.finalState.players)){const cards=[...p.deck,...p.hand,...p.breakArea,...p.discardPile,...p.supportArea.map(c=>c.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])];assert.equal(cards.length,60);assert.equal(new Set(cards.map(c=>c.instanceId)).size,60);const counts=new Map();for(const c of cards)counts.set(c.id,(counts.get(c.id)??0)+1);assert.ok([...counts.values()].every(n=>n<=4))}
   assert.deepEqual(errors,[]);row.status='PASS';row.replay=path;row.publicResult={sourceHp,otherHp:otherCookie.hpCards.length,paidEnergy:paid,blocked,skip,zero};row.commandKinds=replay.commands.map(c=>c.kind)
  }catch(e){row.error=String(e);throw e}finally{rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{if(browser)await browser.close();server.kill();await writeFile(output+'/results.json',JSON.stringify({scope:'Actual-source conditional HP prepared local Chrome; actual deployment parent is fixture preparation, not full match/online or promotion. Below-threshold button behavior is existing engine policy, not a new payment ruling.',rows},null,2))}
console.log(`PASS ${rows.length} conditional-HP actual-source Chrome cases`)
