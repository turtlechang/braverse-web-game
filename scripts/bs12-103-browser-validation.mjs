import assert from 'node:assert/strict'
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root=resolve(fileURLToPath(new URL('..',import.meta.url))), require=createRequire(import.meta.url)
const module=await import(pathToFileURL(require.resolve('playwright',{paths:process.env.PLAYWRIGHT_NODE_MODULES?[process.env.PLAYWRIGHT_NODE_MODULES]:[root]})).href)
const chromium=module.chromium??module.default?.chromium, out=resolve(root,process.env.BS12_BROWSER_OUTPUT??'test-results/bs12-103-browser')
mkdirSync(out,{recursive:true})
const records=['data/cards/official-festival-arena-bs12.en.json',...readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).map(f=>`data/cards/${f}`)]
  .flatMap(path=>JSON.parse(readFileSync(resolve(root,path),'utf8')).cards??[])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const name="Veteran Director's Sunglasses",sourceArt=records.find(c=>c.cardNumber==='BS12-103').imageUrl
const state=page=>page.evaluate(()=>{
  const side=id=>{
    const field=document.querySelector(`.battle-row[data-animation-player="${id}"]`)
    return {deck:Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent),trash:Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      hand:Number(field?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1]??0),
      handIds:[...(field?.querySelectorAll('.hand-card-wrap')??[])].map(node=>node.getAttribute('data-card-instance-id')),
      handArt:[...(field?.querySelectorAll('.hand-card-wrap img')??[])].map(img=>img.getAttribute('src')),
      breakLevel:Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]??0),
      battle:[...(field?.querySelectorAll('.combat-card-wrap')??[])].map(node=>({id:node.getAttribute('data-card-instance-id'),hp:Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]??NaN),rested:node.querySelector('.card-face')?.classList.contains('is-rested')??false})),
      support:[...(field?.querySelectorAll('.support-card-wrap')??[])].map(node=>({id:node.getAttribute('data-card-instance-id'),rested:node.querySelector('.card-face')?.classList.contains('is-rested')??false}))}
  }
  return {own:side('player-one'),enemy:side('player-two')}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({commandKind:e.commandKind,summary:e.summary,steps:(e.steps??[]).map(s=>typeof s==='string'?s:s.text)})))
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]')&&![...document.querySelectorAll('button')].some(b=>b.textContent?.trim()==='略過目前演出'),null,{timeout:20000})
const fixtures=['positive','mixed','cookie','stage','item','trap','two-valid','no-target','wrong-color','wrong-keyword','split','hand-only','trash-only','support-only','break-only','opponent-only',
  'no-energy','wrong-energy','rested-energy','spare-energy','opponent-turn','outside-main','short-deck','one-card','three-cards','exact-four','empty-deck','no-refresh','break-nine']
const extras=['zero','zero-mixed','select-deselect','return','selection-max','cancel-payment','payment-deselect','reopen','minimize-payment','minimize-peek','details','spare-other','exact-four-zero','short-zero']
const blocked=['no-energy','wrong-energy','rested-energy','opponent-turn','outside-main']
const invalid=['no-target','wrong-color','wrong-keyword','split','hand-only','trash-only','support-only','break-only','opponent-only']
const route=s=>s==='zero-mixed'?'mixed':s==='spare-other'?'spare-energy':s==='exact-four-zero'?'exact-four':s==='short-zero'?'short-deck':extras.includes(s)?'positive':s
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)})
const results=[]
try{
  for(const viewport of [{width:1280,height:720},{width:1164,height:777}]) for(const scenario of [...fixtures,...extras].filter(s=>!process.env.BS12_BROWSER_CASES||process.env.BS12_BROWSER_CASES.split(',').includes(s))){
    const page=await browser.newPage({viewport}),row={number:'BS12-103',scenario,viewport,printedSourceAttested:true,status:'FAIL',errors:[],networkFailures:[]}
    page.on('pageerror',error=>row.errors.push(error.message));page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text())})
    page.on('requestfailed',request=>row.networkFailures.push({url:request.url(),error:request.failure()?.errorText}))
    const shot=label=>page.screenshot({path:resolve(out,`${scenario}-${viewport.width}-${label}.png`)})
    const refresh=async()=>{const modal=page.locator('.decision-modal:visible');await modal.waitFor();assert.match(await modal.innerText(),/牌庫 Refresh/);await shot('refresh');await modal.getByRole('button').filter({hasText:'Peach Cookie'}).click();await settle(page)}
    try{
      for(const a of art)await page.route(a.record.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(a.path)}))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:BS12-103':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='split'?'card-negative:BS12-103':'bs12-103:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor();await settle(page);row.before=await state(page);row.beforeTrace=await trace(page);assert.deepEqual(await trace(page),row.beforeTrace)
      const hand=page.locator('.battle-row[data-animation-player="player-one"] .hand-card-wrap[data-card-instance-id="bs12-103-item"]')
      const sourceImage=hand.locator('img').first();assert.equal(await sourceImage.getAttribute('src'),sourceArt);await sourceImage.evaluate(img=>img.decode());row.originalArtVisible=true
      if(scenario==='empty-deck'){assert.equal(row.before.own.deck,0);await refresh();row.refreshedBeforePayment=await state(page);assert.equal(row.refreshedBeforePayment.own.deck,6);assert.equal(row.refreshedBeforePayment.own.support[0].rested,false);assert.ok(row.refreshedBeforePayment.own.handIds.includes('bs12-103-item'));row.initialBeforeRefresh=row.before;row.before=row.refreshedBeforePayment;row.beforeTrace=await trace(page)}
      await hand.locator('button.card-face').click()
      if(scenario==='details'){
        await hand.getByRole('button',{name:'詳情',exact:true}).click();const detail=page.getByRole('dialog',{name:`${name} 卡牌詳情`,exact:true});await detail.waitFor()
        assert.match(await detail.innerText(),/View 4.*reveal up to 1.*Arena.*hand.*remaining.*trash/s);assert.equal(await detail.locator('img').first().getAttribute('src'),sourceArt)
        await shot('details');await detail.getByRole('button',{name:'關閉',exact:true}).click();assert.deepEqual(await state(page),row.before)
      }else if(blocked.includes(scenario)){
        assert.equal(await hand.getByRole('button',{name:'使用',exact:true}).count(),0);assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)
      }else{
        await hand.getByRole('button',{name:'使用',exact:true}).click();const panel=page.locator('.effect-panel:visible');await panel.waitFor()
        const confirm=panel.getByRole('button',{name:'確認發動',exact:true}),payments=panel.locator('.effect-candidates-payment .effect-candidate-entry > button')
        assert.equal(await confirm.isEnabled(),false);assert.equal(await payments.count(),route(scenario)==='spare-energy'?2:1)
        assert.equal(await panel.locator('.effect-candidates-target button').count(),0)
        const paymentIndex=scenario==='spare-other'?1:0;await payments.nth(paymentIndex).click();assert.equal(await confirm.isEnabled(),true)
        if(scenario==='payment-deselect'){await payments.nth(paymentIndex).click();assert.equal(await confirm.isEnabled(),false);await payments.nth(paymentIndex).click()}
        if(scenario==='reopen'){await panel.getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace);await hand.locator('button.card-face').click();await hand.getByRole('button',{name:'使用',exact:true}).click();assert.equal(await confirm.isEnabled(),false);await payments.nth(0).click()}
        if(scenario==='minimize-payment'){await panel.getByRole('button',{name:'縮小',exact:true}).click();await page.getByRole('button',{name:`${name} 使用物品`,exact:true}).click();assert.match(await panel.innerText(),/已選 1／1/)}
        await shot('payment')
        if(scenario==='cancel-payment'){await panel.getByRole('button',{name:'取消技能',exact:true}).click();await settle(page);assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)}
        else{
          await confirm.click();await settle(page)
          if(['one-card','short-deck','three-cards','short-zero','break-nine'].includes(scenario)){assert.equal(await page.locator('.inspect-deck-modal:visible').count(),0);await refresh()}
          if(['no-refresh','break-nine'].includes(scenario)){
            assert.equal(await page.locator('.inspect-deck-modal:visible').count(),0);assert.match(await page.locator('body').innerText(),/敗北|勝利/)
            row.finished=true;assert.equal((await state(page)).own.hand,0)
          }else{
            const peek=page.locator('.inspect-deck-modal:visible');await peek.waitFor();row.peek=await state(page)
            assert.match(await peek.innerText(),/查看 4 張牌.*最多選 1 張.*其餘放入棄牌區/s);assert.match(await peek.innerText(),/所選卡將公開展示後加入手牌/)
            assert.equal(await peek.locator('.inspect-deck-sort').count(),0);const choices=peek.locator('.inspect-deck-grid > button');assert.equal(await choices.count(),4)
            row.viewed=await choices.evaluateAll(nodes=>nodes.map(n=>({label:n.getAttribute('aria-label'),disabled:n.disabled,art:n.querySelector('img')?.getAttribute('src')})))
            await peek.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())))
            const enabled=await choices.evaluateAll(nodes=>nodes.map(n=>!n.disabled));const expected=invalid.includes(scenario)?[false,false,false,false]:scenario==='empty-deck'?row.viewed.map(view=>{const original=records.find(c=>c.imageUrl===view.art);assert.ok(original,'Peek has no original printed record');return original.color==='BLACK'&&original.keywords.includes('Arena')}):['mixed','two-valid','zero-mixed'].includes(scenario)?[true,false,false,true]:null
            if(expected)assert.deepEqual(enabled,expected)
            if(scenario==='empty-deck')for(const view of row.viewed.filter(v=>v.art===records.find(c=>c.cardNumber==='BS12-095').imageUrl))assert.equal(view.label,'選擇Blueberry Cake Hound')
            assert.deepEqual(row.peek.enemy,row.before.enemy);assert.deepEqual(row.peek.own.battle,row.before.own.battle)
            assert.equal(row.peek.own.support[paymentIndex].rested,true);if(route(scenario)==='spare-energy')assert.equal(row.peek.own.support[1-paymentIndex].rested,false)
            if(['one-card','short-deck','three-cards','short-zero'].includes(scenario)){assert.equal(row.peek.own.deck,7-(4-row.before.own.deck));assert.equal(row.peek.own.trash,0);assert.equal(row.peek.own.breakLevel,1)}
            const peekTrace=await trace(page),publicBefore=JSON.stringify(peekTrace);assert.deepEqual(peekTrace.slice(0,row.beforeTrace.length),row.beforeTrace);assert.deepEqual(peekTrace.map(e=>e.commandKind),[...row.beforeTrace.map(e=>e.commandKind),'begin-play-item','resolve-ability-effect',...(['one-card','short-deck','three-cards','short-zero'].includes(scenario)?['refresh-deck']:[])])
            for(const number of ['BS12-094','BS12-102','BS12-105'])assert.ok(!publicBefore.includes(records.find(c=>c.cardNumber===number).name),'Private peek leaked before confirmation')
            const zero=['zero','zero-mixed','return','exact-four-zero','short-zero','empty-deck',...invalid].includes(scenario)
            const index=scenario==='stage'?1:scenario==='item'?2:scenario==='trap'?3:scenario==='two-valid'?3:0
            if(!zero||scenario==='return'){
              await choices.nth(index).click();assert.equal(await choices.nth(index).getAttribute('class'),'is-selected')
              if(scenario==='selection-max')assert.equal(await choices.nth(1).isEnabled(),false)
              if(scenario==='select-deselect'){await choices.nth(index).click();assert.equal(await peek.locator('.is-selected').count(),0);await choices.nth(index).click()}
              if(scenario==='return'){await peek.getByRole('button',{name:'返回',exact:true}).click();assert.equal(await peek.locator('.is-selected').count(),0)}
              if(scenario==='minimize-peek'){await peek.getByRole('button',{name:'縮小',exact:true}).click();const dock=page.locator('.decision-reveal-dock');assert.match(await dock.innerText(),/已選 1 張/);await dock.click();await peek.waitFor();assert.equal(await peek.locator('.is-selected').count(),1)}
            }
            const bounds=await peek.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y+bounds.height<=viewport.height+1)
            await shot('peek');await peek.getByRole('button',{name:'確認並結算',exact:true}).click();await settle(page);row.settled=await state(page)
            assert.equal(row.settled.own.hand,row.peek.own.hand+(zero?0:1));assert.equal(row.settled.own.trash,row.peek.own.trash+(zero?4:3));assert.equal(row.settled.own.deck,row.peek.own.deck)
            if(!zero){assert.ok(row.settled.own.handArt.includes(row.viewed[index].art));row.chosenArt=row.viewed[index].art}
            const resolved=(await trace(page)).find(e=>e.commandKind==='resolve-inspect-deck');assert.ok(resolved);assert.match(resolved.steps.join(' '),zero?/選擇 0 張，沒有牌加入手牌/:/展示並加入手牌/);assert.match(resolved.steps.join(' '),/未選卡進棄牌區/)
            if(['exact-four','exact-four-zero'].includes(scenario)){assert.equal(row.peek.own.deck,0);await refresh();const after=await state(page);assert.equal(after.own.deck,zero?11:10);assert.equal(after.own.trash,0);assert.equal(after.own.hand,zero?0:1)}
            if(['positive','zero','mixed','split','cookie','stage','item','trap','short-deck','exact-four-zero'].includes(scenario)){
              await page.getByRole('button',{name:'對戰紀錄',exact:true}).click();const log=page.getByRole('complementary',{name:'對戰紀錄側欄',exact:true});await log.locator('.battle-log-entry').filter({hasText:'使用了道具卡'}).first().click()
              row.visiblePublicLog=await log.innerText();assert.match(row.visiblePublicLog,zero?/選擇 0 張/:/展示並加入手牌/);assert.match(row.visiblePublicLog,/未選卡進棄牌區/);await shot('public-log');await page.getByRole('button',{name:'關閉對戰紀錄',exact:true}).click()
            }
            assert.equal(await page.getByRole('button',{name:'結束主要階段',exact:true}).isEnabled(),true)
          }
        }
      }
      row.after=await state(page);row.trace=await trace(page);await shot('result');assert.deepEqual(row.errors,[])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      row.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      row.cancelledOriginalImageRequests = row.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      row.networkFailures = row.networkFailures.filter(entry => !row.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(row.networkFailures, [])
      if(row.settled){assert.deepEqual(row.trace.slice(0,row.beforeTrace.length),row.beforeTrace);assert.deepEqual(row.trace.map(e=>e.commandKind),[...row.beforeTrace.map(e=>e.commandKind),'begin-play-item','resolve-ability-effect',...(['one-card','short-deck','three-cards','short-zero'].includes(scenario)?['refresh-deck']:[]),'resolve-inspect-deck',...(['exact-four','exact-four-zero'].includes(scenario)?['refresh-deck']:[])])}
      row.status='PASS';console.log(`PASS BS12-103 ${scenario} ${viewport.width}x${viewport.height}`)
    }catch(error){row.error=error.stack??String(error);row.dom=(await page.locator('body').innerText()).slice(0,16000);await shot('FAIL');results.push(row);writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2));throw error}
    finally{await page.close()}
    results.push(row);writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2))
  }
}finally{await browser.close()}
console.log(`BS12-103 Browser ${results.filter(r=>r.status==='PASS').length}/${results.length}`)
