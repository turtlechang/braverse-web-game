import assert from 'node:assert/strict'
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', {paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root]})).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-102-browser')
mkdirSync(out, {recursive: true})
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).map(f=>`data/cards/${f}`)]
  .flatMap(path=>JSON.parse(readFileSync(resolve(root,path),'utf8')).cards??[])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const stageName="Manager Scarlet's Coffee Truck",stageArt=records.find(c=>c.cardNumber==='BS12-102').imageUrl
const state = page=>page.evaluate(()=>{
  const side = placement=>{
    const field=document.querySelector(`.${placement}-field`)
    return {deck:Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent),
      trash:Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent), hand:field?.querySelectorAll('.hand-card').length??0,
      handArt:[...(field?.querySelectorAll('.hand-card img')??[])].map(img=>img.getAttribute('src')),
      stage:field?.querySelector('.stage-zone img')?.getAttribute('src')??null,
      stageRested:field?.querySelector('.stage-zone .card-face')?.classList.contains('is-rested')??false,
      battle:[...(field?.querySelectorAll('.combat-card-wrap')??[])].map(node=>({id:node.getAttribute('data-card-instance-id'),
        hp:Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]??NaN),rested:node.querySelector('.card-face')?.classList.contains('is-rested')??false})),
      support:[...(field?.querySelectorAll('.support-card-wrap')??[])].map(node=>({id:node.getAttribute('data-card-instance-id'),rested:node.querySelector('.card-face')?.classList.contains('is-rested')??false})),
      breakLevel:Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]??NaN)}
  }
  return {bottom:side('bottom'),top:side('top')}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({commandKind:e.commandKind,summary:e.summary,steps:(e.steps??[]).map(s=>typeof s==='string'?s:s.text)})))
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]')&&!Array.from(document.querySelectorAll('button')).some(b=>b.textContent?.trim()==='略過目前演出'),null,{timeout:20000})
const fixtures=['positive','four-targets','crimson','pudding','strategist','mixed','no-target','arena-only','special-only','split','stage-only','opponent-only','hand-only','support-only','break-only','zones',
  'no-energy','wrong-energy','rested-energy','one-energy','spare-energy','placed','rested-source','opponent-turn','outside-main','no-energy-activate','wrong-energy-activate','rested-energy-activate','replace']
const extras=['zero','other-target','last-target','cancel-placement','deselect-placement','cancel-energy','cancel-cost','cancel-target','back-energy','back-cost','deselect-energy','deselect-target','target-max','hand-preview','minimize-target']
const prepared=['placed','rested-source','opponent-turn','outside-main','no-energy-activate','wrong-energy-activate','rested-energy-activate']
const noTargets=['no-target','arena-only','special-only','split','stage-only','opponent-only','hand-only','support-only','break-only']
const blockedPlace=['no-energy','wrong-energy','rested-energy']
const blockedActivate=['one-energy',...prepared.filter(s=>s!=='placed')]
const route=scenario=>['other-target','last-target','target-max'].includes(scenario)?'four-targets':extras.includes(scenario)?'positive':scenario
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)})
const results=[]
try {
  for(const viewport of [{width:1280,height:720},{width:1164,height:777}]) for(const scenario of [...fixtures,...extras].filter(s=>!process.env.BS12_BROWSER_CASES||process.env.BS12_BROWSER_CASES.split(',').includes(s))) {
    const page=await browser.newPage({viewport}), row={number:'BS12-102',scenario,viewport,printedSourceAttested:true,status:'FAIL',errors:[],networkFailures:[]}
    page.on('pageerror',error=>row.errors.push(error.message)); page.on('console',message=>{if(message.type()==='error')row.errors.push(message.text())})
    page.on('requestfailed',request=>row.networkFailures.push({url:request.url(),error:request.failure()?.errorText}))
    const shot=label=>page.screenshot({path:resolve(out,`${scenario}-${viewport.width}-${label}.png`)})
    try {
      for(const a of art) await page.route(a.record.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(a.path)}))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:BS12-102':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='split'?'card-negative:BS12-102':'bs12-102:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor(); await settle(page); row.before=await state(page);row.beforeTrace=await trace(page); assert.deepEqual(await trace(page),row.beforeTrace)
      const sourceImage=page.locator(`.bottom-field ${prepared.includes(scenario)?'.stage-zone':'.hand-card-wrap[data-card-instance-id="bs12-102-stage"]'} img`).first()
      assert.equal(await sourceImage.getAttribute('src'),stageArt); await sourceImage.evaluate(img=>img.decode()); row.originalArtVisible=true
      if(scenario==='hand-preview') {
        await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-102-stage"] .card-face').click()
        await page.getByRole('button',{name:'詳情',exact:true}).click(); const detail=page.getByRole('dialog',{name:`${stageName} 卡牌詳情`,exact:true}); await detail.waitFor()
        assert.match(await detail.innerText(),/Rest this card.*Return up to 1.*Arena.*Cookie.*Special Play.*trash.*hand/s)
        assert.equal(await detail.locator('img').first().getAttribute('src'),stageArt); await shot('details')
        await detail.getByRole('button',{name:'關閉',exact:true}).click(); assert.deepEqual(await state(page),row.before)
      } else if(blockedPlace.includes(scenario)) {
        await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-102-stage"] .card-face').click()
        assert.equal(await page.getByRole('button',{name:'放置',exact:true}).count(),0); assert.deepEqual(await state(page),row.before)
      } else {
        if(!prepared.includes(scenario)) {
          await page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-102-stage"] .card-face').click(); await page.getByRole('button',{name:'放置',exact:true}).click()
          const modal=page.getByRole('alertdialog',{name:`${stageName} 場景放置付款`,exact:true}); await modal.waitFor()
          assert.equal(await modal.locator('img').first().getAttribute('src'),stageArt); const pay=modal.getByRole('button',{name:'支付並放置',exact:true})
          assert.equal(await pay.isEnabled(),false); const choices=modal.locator('.modal-card-options > button'); assert.equal(await choices.count(),scenario==='one-energy'?1:scenario==='spare-energy'?3:2)
          await choices.nth(0).click(); assert.equal(await pay.isEnabled(),true)
          if(scenario==='deselect-placement') {await choices.nth(0).click();assert.equal(await pay.isEnabled(),false);await choices.nth(0).click()}
          await shot('placement-payment')
          if(scenario==='cancel-placement') {await modal.getByRole('button',{name:'取消',exact:true}).click(); assert.deepEqual(await state(page),row.before)}
          else {await pay.click();await modal.waitFor({state:'hidden'});await settle(page);row.placed=await state(page)
            assert.equal(row.placed.bottom.stage,stageArt);assert.equal(row.placed.bottom.stageRested,false);assert.equal(row.placed.bottom.hand,row.before.bottom.hand-1)
            assert.equal(row.placed.bottom.support[0].rested,true);assert.equal(row.placed.bottom.trash,row.before.bottom.trash+(scenario==='replace'?1:0))
            assert.equal(row.placed.bottom.deck,row.before.bottom.deck);assert.deepEqual(row.placed.bottom.battle,row.before.bottom.battle)
          }
        } else row.placed=row.before
        if(scenario==='cancel-placement') assert.deepEqual(await trace(page),row.beforeTrace)
        else if(blockedActivate.includes(scenario)) {assert.equal(await page.locator('.bottom-field .stage-quick-action').count(),0);assert.deepEqual(await state(page),row.placed)}
        else {
          await page.locator('.bottom-field .stage-quick-action').click();const panel=page.locator('.effect-panel:not(.is-complete):visible');await panel.waitFor()
          assert.match(await panel.innerText(),/啟動場景.*BS12-102/s); const next=panel.getByRole('button',{name:'下一步',exact:true});assert.equal(await next.isEnabled(),false)
          const energy=panel.getByRole('button',{name:/Subtle Jasmine Cake Hound.*點擊選取/});const count=await energy.count();assert.equal(count,scenario==='placed'||scenario==='spare-energy'?2:1)
          await energy.nth(scenario==='placed'?1:0).click();assert.equal(await next.isEnabled(),true)
          if(scenario==='deselect-energy') {await panel.getByRole('button',{name:/Subtle Jasmine Cake Hound.*已選取/}).click();assert.equal(await next.isEnabled(),false);await energy.nth(0).click()}
          const cancel=async()=>{await panel.getByRole('button',{name:'取消技能',exact:true}).click();await settle(page);assert.deepEqual(await state(page),row.placed)}
          if(scenario==='cancel-energy') await cancel()
          else {
            await next.click();assert.match(await panel.innerText(),/額外代價.*將效果來源卡橫置/s)
            if(scenario==='back-energy') {await panel.getByRole('button',{name:'上一步',exact:true}).click();assert.match(await panel.innerText(),/能量支付/);await next.click()}
            if(scenario==='cancel-cost') await cancel()
            else {
              await next.click(); if(scenario==='back-cost') {await panel.getByRole('button',{name:'上一步',exact:true}).click();assert.match(await panel.innerText(),/將效果來源卡橫置/);await next.click()}
              const names=noTargets.includes(scenario)?[]:route(scenario)==='four-targets'?['Blueberry Cake Hound','Crimson Danger Cake Hound','Caramel Pudding Cake Hound','Strategist Cake Hound']
                :[scenario==='crimson'||scenario==='zones'?'Crimson Danger Cake Hound':scenario==='pudding'?'Caramel Pudding Cake Hound':scenario==='strategist'?'Strategist Cake Hound':'Blueberry Cake Hound']
              const choices=panel.getByRole('button',{name:/(Blueberry Cake Hound|Crimson Danger Cake Hound|Caramel Pudding Cake Hound|Strategist Cake Hound).*點擊選取/})
              assert.equal(await choices.count(),names.length);for(const name of names)assert.equal(await panel.getByRole('button',{name:new RegExp(`${name}.*點擊選取`)}).count(),1)
              assert.equal(await panel.getByRole('button',{name:/Chess Choco Cookie.*點擊選取/}).count(),0);assert.equal(await panel.getByRole('button',{name:/Licorice Cookie.*點擊選取/}).count(),0)
              const zero=scenario==='zero'||noTargets.includes(scenario), selected=scenario==='other-target'?1:scenario==='last-target'?3:0
              if(!zero) {await choices.nth(selected).click()
                if(scenario==='deselect-target') {await panel.getByRole('button',{name:/Blueberry Cake Hound.*已選取/}).click();assert.match(await panel.innerText(),/已選 0／1/);await choices.nth(0).click()}
                if(scenario==='target-max') {await panel.getByRole('button',{name:/Crimson Danger Cake Hound.*點擊選取/}).click();assert.match(await panel.innerText(),/已選 1／1/);assert.equal(await panel.getByRole('button',{name:/Blueberry Cake Hound.*已選取/}).count(),1)}
              }
              if(scenario==='minimize-target') {await panel.getByRole('button',{name:'縮小',exact:true}).click();await page.locator('.effect-panel-dock').click();await panel.waitFor();assert.equal(await panel.getByRole('button',{name:/Blueberry Cake Hound.*已選取/}).count(),1)}
              await shot('activation-target')
              if(scenario==='cancel-target') await cancel()
              else {
                await panel.getByRole('button',{name:'確認發動',exact:true}).click();await panel.waitFor({state:'hidden'});await settle(page);row.after=await state(page)
                assert.equal(row.after.bottom.stage,stageArt);assert.equal(row.after.bottom.stageRested,true)
                assert.deepEqual(row.after.bottom.support,row.placed.bottom.support.map((entry,i)=>({...entry,rested:entry.rested||i===1})))
                assert.equal(row.after.bottom.hand,row.placed.bottom.hand+(zero?0:1));assert.equal(row.after.bottom.trash,row.placed.bottom.trash-(zero?0:1))
                assert.equal(row.after.bottom.deck,row.placed.bottom.deck);assert.equal(row.after.bottom.breakLevel,row.placed.bottom.breakLevel);assert.deepEqual(row.after.bottom.battle,row.placed.bottom.battle);assert.deepEqual(row.after.top,row.before.top)
                if(!zero) {const number=names[selected]==='Blueberry Cake Hound'?'BS12-095':names[selected]==='Crimson Danger Cake Hound'?'BS12-096':names[selected]==='Caramel Pudding Cake Hound'?'BS12-098':'BS12-100';assert.ok(row.after.bottom.handArt.includes(records.find(c=>c.cardNumber===number).imageUrl))}
                assert.equal(await page.locator('.bottom-field .stage-quick-action').count(),0)
                row.trace=await trace(page);assert.deepEqual(row.trace.map(e=>e.commandKind),[...(prepared.includes(scenario)?[]:['play-stage']),'begin-activate-stage','resolve-ability-effect'])
                const text=row.trace.flatMap(e=>e.steps).join(' ');assert.match(text,/場景代價.*Manager Scarlet.*支付能量/s);assert.match(text,zero?/選擇 0 個目標/:/棄牌區.*手牌/)
                if(['positive','zero','split','replace','other-target','last-target'].includes(scenario)) {await page.getByRole('button',{name:'對戰紀錄',exact:true}).click();const log=page.getByRole('complementary',{name:'對戰紀錄側欄'});await log.locator('.battle-log-entry').filter({hasText:'發動了場景效果'}).first().click();row.visiblePublicLog=await log.innerText();assert.match(row.visiblePublicLog,/場景代價.*Manager Scarlet/s);assert.match(row.visiblePublicLog,zero?/選擇 0 個目標/:/回收結果.*棄牌區.*手牌/s);await shot('public-log');await page.getByRole('button',{name:'關閉對戰紀錄',exact:true}).click()}
                assert.equal(await page.getByRole('button',{name:'結束主要階段',exact:true}).isEnabled(),true)
              }
            }
          }
          if(scenario.startsWith('cancel-'))assert.deepEqual((await trace(page)).map(e=>e.commandKind),['play-stage'])
        }
      }
      row.after??=await state(page);row.trace??=await trace(page);await shot('result');assert.deepEqual(row.errors,[])
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
      row.status='PASS';console.log(`PASS BS12-102 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch(error) {row.error=error.stack??String(error);row.dom=(await page.locator('body').innerText()).slice(0,14000);await shot('FAIL');results.push(row);writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2));throw error}
    finally {await page.close()}
    results.push(row);writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2))
  }
} finally {await browser.close()}
console.log(`BS12-102 Browser ${results.filter(r=>r.status==='PASS').length}/${results.length}`)
