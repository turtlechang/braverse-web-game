import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.ST6016_OUTPUT??'output/st6-st10/st6-016-browser-formal'
await mkdir(output,{recursive:true})
const port=4237,rows=[]
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',process.env.ST6016_DIST??'dist'],{stdio:'ignore'})
let browser
try{
 browser=await chromium.launch({channel:'chrome',headless:true})
 const scenarios=['forward','reverse','single-first','single-second','zero','negative','wrong-color','wrong-phase','no-discard','cancel-payment','missing-discard','reselect','faint','flip-forward-activate','flip-reverse-activate']
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of scenarios){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[],httpErrors:[]}
  page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)row.httpErrors.push({url:r.url(),status:r.status()})})
  try{
   await page.route(`http://127.0.0.1:${port}/favicon.ico`,async r=>r.fulfill({contentType:'image/png',body:await readFile('public/card-back.png')}))
   const route=scenario.startsWith('flip-')?'reveal':scenario==='faint'?'faint':['negative','wrong-color','wrong-phase','no-discard'].includes(scenario)?scenario:'positive'
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:ST6-016:${route}&contract-card=ST6-016`)
   await page.locator('.bottom-field').waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const hand=page.locator('.bottom-hand .hand-card-wrap').filter({has:page.getByRole('img',{name:"Dragon's Breath",exact:true})})
   const art=hand.locator('img').first();await art.evaluate(img=>img.decode());assert.match(await art.getAttribute('src'),/czwAXttL-Bsd_jJW1M11Uw\.webp/)
   await hand.locator('button.card-face').click()
   const use=hand.getByRole('button',{name:'使用',exact:true})
   if(['negative','wrong-color','wrong-phase','no-discard'].includes(scenario)){
    assert.equal(await use.count(),0)
    const details=page.getByRole('dialog',{name:"Dragon's Breath 卡牌詳情",exact:true})
    if(await details.count())await details.locator('.close-modal').click()
   }
   else{
    await use.click()
    const panel=page.locator('.effect-panel:not(.is-complete):visible');await panel.waitFor()
    const payment=panel.locator('.effect-candidates-payment button:not([disabled])')
    assert.equal(await payment.count(),3)
    for(const i of [0,1,2])await payment.nth(i).click()
    await panel.getByRole('button',{name:'下一步',exact:true}).click()
    const discards=panel.locator('.effect-candidates-discard-hand button')
    assert.ok(await discards.count()>=1)
    if(scenario!=='missing-discard')await discards.first().click()
    if(['missing-discard','cancel-payment'].includes(scenario)){
     if(scenario==='missing-discard')assert.equal(await panel.getByRole('button',{name:'下一步',exact:true}).isEnabled(),false)
     await panel.getByRole('button',{name:'取消技能',exact:true}).click()
    }else{
     await panel.getByRole('button',{name:'下一步',exact:true}).click()
     const targets=panel.locator('.effect-candidates-target button')
     assert.equal(await targets.count(),2)
     const order=scenario==='forward'||scenario==='flip-forward-activate'||scenario==='flip-forward-skip'?[0,1]:scenario==='reverse'||scenario==='reselect'||scenario==='faint'||scenario==='flip-reverse-activate'||scenario==='flip-reverse-skip'?[1,0]:scenario==='single-first'?[0]:scenario==='single-second'?[1]:[]
     if(scenario==='reselect'){for(const i of [0,1,0,0])await targets.nth(i).click()}
     else for(const i of order)await targets.nth(i).click()
     for(const [rank,index]of order.entries())assert.match(await targets.nth(index).innerText(),new RegExp('第 '+(rank+1)+' 順位'))
     await page.screenshot({path:`${output}/${scenario}-${viewport.width}-selection.png`,fullPage:true})
     await panel.getByRole('button',{name:'確認發動',exact:true}).click()
     await page.waitForFunction(()=>!document.querySelector('.effect-panel:not(.is-complete)'))
     if(scenario.startsWith('flip-'))await page.waitForFunction(()=>document.querySelector('.top-field .row-stat-hand b')?.textContent.trim()==='1'&&!document.querySelector('.top-field')?.textContent.includes('FLIP'))
    }
   }
   await page.screenshot({path:`${output}/${scenario}-${viewport.width}-result.png`,fullPage:true})
   await page.getByTestId('battle-log-toggle').click()
   const event=page.waitForEvent('download');await page.getByTestId('battle-log-export-replay').click()
   await (await event).saveAs(`${output}/${scenario}-${viewport.width}-replay.json`)
   const replay=JSON.parse(await readFile(`${output}/${scenario}-${viewport.width}-replay.json`,'utf8'))
   const before=replay.initialState,after=replay.finalState
   const blocked=['negative','wrong-color','wrong-phase','no-discard','missing-discard','cancel-payment'].includes(scenario)
   const commands=replay.commands
   if(blocked){assert.equal(commands.some(c=>c.kind==='begin-play-item'),false);assert.deepEqual(after.players,before.players)}
   else{
    const begin=commands.find(c=>c.kind==='begin-play-item'),resolve=commands.find(c=>c.kind==='resolve-ability-effect')
    assert.ok(begin&&resolve);assert.equal(begin.paymentIds.length,3);assert.equal(begin.discardHandIds.length,1)
    assert.notEqual(begin.discardHandIds[0],begin.instanceId)
    const order=scenario==='forward'||scenario==='flip-forward-activate'||scenario==='flip-forward-skip'?[0,1]:scenario==='reverse'||scenario==='reselect'||scenario==='faint'||scenario==='flip-reverse-activate'||scenario==='flip-reverse-skip'?[1,0]:scenario==='single-first'?[0]:scenario==='single-second'?[1]:[]
    const foe=before.players['player-two'].battleArea
    assert.deepEqual(resolve.targetIds,order.map(i=>foe[i].card.instanceId))
    for(const [i,c]of foe.entries()){
     const index=order.indexOf(i),damage=index===0?2:index===1?1:0
     const survivor=after.players['player-two'].battleArea.find(x=>x.card.instanceId===c.card.instanceId)
     if(damage>=c.hpCards.length){assert.equal(survivor,undefined);assert.ok(after.players['player-two'].breakArea.some(x=>x.instanceId===c.card.instanceId))}
     else assert.deepEqual(survivor.hpCards,c.hpCards.slice(0,c.hpCards.length-damage))
    }
    assert.equal(after.players['player-one'].supportArea.filter(s=>s.rested).length,3)
    assert.equal(after.players['player-one'].hand.length,before.players['player-one'].hand.length-2)
    assert.equal(after.pendingAbilityEffect,undefined)
    if(scenario.startsWith('flip-')){
     const flip=commands.find(c=>c.kind==='resolve-flip')
     assert.ok(flip,'Opponent AI must respond to actual Cherry FLIP in item damage sequence')
     assert.equal(flip.playerId,'player-two');assert.equal(flip.activate,true)
     assert.ok(after.players['player-two'].hand.some(c=>c.id==='ST6-006'))
    }
   }
   for(const state of [before,after])for(const p of Object.values(state.players)){
    const cards=[...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
    assert.equal(cards.length,60);assert.equal(new Set(cards.map(c=>c.instanceId)).size,60)
    const counts=new Map();for(const c of cards){assert.ok(c.imageUrl);counts.set(c.id,(counts.get(c.id)??0)+1)}assert.ok([...counts.values()].every(n=>n<=4))
   }
   assert.deepEqual(row.errors,[]);assert.deepEqual(row.httpErrors,[]);row.status='PASS';console.log(`PASS ST6-016 ${scenario} ${viewport.width}`)
  }catch(e){row.error=e.stack;row.dom=(await page.locator('body').innerText()).slice(0,14000);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-FAIL.png`,fullPage:true});throw e}
  finally{rows.push(row);await writeFile(output+'/results.json',JSON.stringify(rows,null,2));await page.close()}
 }
}finally{await browser?.close();server.kill()}
