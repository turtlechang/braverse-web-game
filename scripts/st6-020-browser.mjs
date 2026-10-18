import {createHash} from 'node:crypto'
import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.ST6020_BROWSER_OUTPUT??'output/st6-st10/st6-020-browser-formal',port=4243,rows=[]
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort','--outDir',process.env.ST6020_BROWSER_DIST??'dist'],{stdio:'ignore'})
let browser
const cases=['positive','other-hp','green-arena','low','rested-source','no-battle','draw-refresh','negative','wrong-color','one-red','wrong-phase','cancel-place','mixed-place','payment-deselect','cancel-hp','hp-deselect','minimize','draw-zero','draw-toggle']
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:'+port)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of (process.env.ST6020_BROWSER_CASES?.split(',')??cases)){
  const page=await browser.newPage({viewport}),row={scenario,viewport,status:'FAIL',errors:[]};page.setDefaultTimeout(10000)
  page.on('pageerror',e=>row.errors.push(e.message))
  try{
   const route=['other-hp','cancel-place','mixed-place','payment-deselect','cancel-hp','hp-deselect','minimize','draw-zero','draw-toggle'].includes(scenario)?'positive':scenario
   if(process.env.ST6020_ORIGINAL_ART_CACHE){
    const bytes=await readFile(process.env.ST6020_ORIGINAL_ART_CACHE)
    assert.equal(createHash('sha256').update(bytes).digest('hex'),'66d8c3d81f6e94266ac51748f95d1e7bdfbbc2a0847cf1900d3b7c5e0923a637')
    await page.route('https://cookierunbraverse.com/data/en_storage/rYL1FQt-5crUS9bzruP4bw.webp',r=>r.fulfill({contentType:'image/webp',body:bytes}))
   }
   await page.goto('http://127.0.0.1:'+port+'/?test-state=deck-addition:ST6-020:'+route+'&contract-card=ST6-020')
   await page.locator('.bottom-field').waitFor();await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   const hand=page.locator('.bottom-field .hand-card-wrap').first()
   await hand.locator('img').first().evaluate(img=>img.decode());assert.match(await hand.locator('img').first().getAttribute('src'),/rYL1FQt-5crUS9bzruP4bw/)
   await hand.locator('.card-face').click()
   const blocked=['negative','wrong-color','one-red','wrong-phase'].includes(scenario)
   if(blocked){assert.equal(await page.getByRole('button',{name:'放置',exact:true}).count(),0);if(scenario!=='wrong-phase'){await page.locator('.card-detail-modal .close-modal').click();await page.locator('.card-detail-modal').waitFor({state:'hidden'})}}else{
    await page.getByRole('button',{name:'放置',exact:true}).click()
    const modal=page.locator('.stage-placement-modal:visible');await modal.waitFor()
    const payments=modal.locator('.faint-payment-candidates button'),confirm=modal.getByRole('button',{name:'支付並放置',exact:true})
    assert.equal(await confirm.isEnabled(),false);assert.equal(await payments.count(),scenario==='rested-source'?2:4)
    if(scenario==='cancel-place')await modal.getByRole('button',{name:'取消',exact:true}).click()
    else{
     await payments.nth(0).click();assert.equal(await confirm.isEnabled(),false)
     await payments.nth(scenario==='mixed-place'?3:1).click()
     assert.equal(await confirm.isEnabled(),scenario!=='mixed-place')
     if(scenario==='mixed-place'){await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-payment.png',fullPage:true});await modal.getByRole('button',{name:'取消',exact:true}).click()}
     else{
      if(scenario==='payment-deselect'){await payments.nth(0).click();assert.equal(await confirm.isEnabled(),false);await payments.nth(0).click()}
      await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-payment.png',fullPage:true});await confirm.click();await modal.waitFor({state:'hidden'})
      const quick=page.locator('.bottom-field .stage-quick-action')
      if(scenario==='no-battle')assert.equal(await quick.count(),0)
      else{
       await quick.click();const panel=page.locator('.effect-panel[role="alertdialog"]:visible');await panel.waitFor()
       assert.match(await panel.innerText(),/棄置 1 張 HP 卡/)
       const choices=panel.locator('.effect-candidates-hp-cost button'),activate=panel.getByRole('button',{name:'確認發動',exact:true})
       assert.equal(await choices.count(),2);assert.equal(await activate.isEnabled(),false)
       await choices.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())))
       const costIndex=['other-hp','green-arena'].includes(scenario)?1:0
       await choices.nth(costIndex).click();assert.equal(await activate.isEnabled(),true)
       if(scenario==='hp-deselect'){await choices.nth(costIndex).click();assert.equal(await activate.isEnabled(),false);await choices.nth(costIndex).click()}
       if(scenario==='minimize'){await panel.getByRole('button',{name:'縮小',exact:true}).click();await page.getByRole('button',{name:'Into the Depths 啟動場景',exact:true}).click();assert.match(await panel.innerText(),/已選 1 張／1 張 HP 費用/)}
       const bounds=await panel.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1)
       await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-hp.png',fullPage:true})
       if(scenario==='cancel-hp')await panel.getByRole('button',{name:'取消技能',exact:true}).click()
       else{
        await activate.click();await panel.waitFor({state:'hidden'})
        const draw=page.locator('.draw-up-to-modal:visible');await draw.waitFor();assert.equal(await draw.locator('.draw-up-to-option').count(),2)
        await draw.locator('img').first().evaluate(img=>img.decode())
        if(scenario==='draw-zero')await draw.getByRole('button',{name:'略過抽牌',exact:true}).click()
        else{
         await draw.locator('.draw-up-to-option').nth(1).click()
         if(scenario==='draw-toggle'){await draw.locator('.draw-up-to-option').nth(0).click();assert.equal(await draw.getByRole('button',{name:'略過抽牌',exact:true}).isEnabled(),true);await draw.locator('.draw-up-to-option').nth(1).click()}
         await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-draw.png',fullPage:true});await draw.getByRole('button',{name:'抽取 1 張牌',exact:true}).click()
        }
        await draw.waitFor({state:'hidden'})
        if(scenario==='draw-refresh'){
         const refresh=page.locator('.decision-modal:visible');await refresh.waitFor();assert.match(await refresh.innerText(),/牌庫 Refresh/)
         await refresh.getByRole('button').first().locator('img').evaluate(img=>img.decode());await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-refresh.png',fullPage:true});await refresh.getByRole('button').first().click();await refresh.waitFor({state:'hidden'})
        }
        assert.equal(await quick.count(),0)
       }
      }
     }
    }
   }
   await page.getByTestId('battle-log-toggle').click()
   const downloadPromise=page.waitForEvent('download');await page.getByTestId('battle-log-export-replay').click()
   const download=await downloadPromise,path=output+'/'+scenario+'-'+viewport.width+'-replay.json';await download.saveAs(path)
   const replay=JSON.parse(await readFile(path,'utf8')),initial=replay.initialState.players['player-one'],final=replay.finalState.players['player-one']
   const placed=!blocked&&!['cancel-place','mixed-place'].includes(scenario),activated=placed&&!['cancel-hp','no-battle'].includes(scenario)
   const stage=replay.commands.filter(c=>c.kind==='play-stage'),acts=replay.commands.filter(c=>c.kind==='begin-activate-stage'),draws=replay.commands.filter(c=>c.kind==='resolve-draw-up-to')
   assert.equal(stage.length,placed?1:0);assert.equal(acts.length,activated?1:0);assert.equal(draws.length,activated?1:0)
   if(placed){assert.equal(stage[0].paymentIds.length,2);for(const id of stage[0].paymentIds)assert.equal(initial.supportArea.find(s=>s.card.instanceId===id)?.card.energyColor,'red');assert.equal(final.stage?.card.id,'ST6-020');assert.equal(final.stage.rested,activated)}
   if(activated){
    const index=['other-hp','green-arena'].includes(scenario)?1:0,chosen=initial.battleArea[index],remaining=chosen.hpCards.length-1
    assert.deepEqual(acts[0].paymentIds,[]);assert.deepEqual(acts[0].hpToTrashTargetIds,[chosen.card.instanceId]);assert.equal(draws[0].drawCount,scenario==='draw-zero'?0:1)
    assert.equal(final.battleArea.find(c=>c.card.instanceId===chosen.card.instanceId)?.hpCards.length??0,remaining)
    if(remaining===0)assert.ok(final.breakArea.some(c=>c.instanceId===chosen.card.instanceId))
    if(scenario!=='draw-refresh'){assert.ok(final.discardPile.some(c=>c.instanceId===chosen.hpCards.at(-1).instanceId));assert.equal(final.deck.length,initial.deck.length-(scenario==='draw-zero'?0:1))}
    assert.equal(final.hand.length,initial.hand.length-1+(scenario==='draw-zero'?0:1))
    assert.equal(replay.finalState.pendingDrawUpTo??null,null)
   }else assert.deepEqual(final.battleArea,initial.battleArea)
   if(!placed)assert.deepEqual(final,initial)
   if(scenario==='draw-refresh'){assert.equal(replay.commands.filter(c=>c.kind==='refresh-deck').length,1);assert.equal(replay.finalState.pendingRefresh??null,null);assert.ok(final.deck.length>0)}
   assert.equal(row.errors.length,0,row.errors.join('\n'));row.status='PASS';row.commands=replay.commands
  }catch(error){row.error=String(error);throw error}
  finally{rows.push(row);await page.screenshot({path:output+'/'+scenario+'-'+viewport.width+'-'+row.status+'.png',fullPage:true});await page.close()}
 }
}finally{if(browser)await browser.close();server.kill();await writeFile(output+'/results.json',JSON.stringify({scope:'Formal registry original-card prepared test-state, local actual Chrome; not deck-start full-match or online acceptance',rows},null,2))}
console.log('PASS '+rows.length+' actual Chrome ST6-020 cases')
