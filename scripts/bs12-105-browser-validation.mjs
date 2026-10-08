import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium, out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-105-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const name='Perfect Stage',sourceArt=records.find(c=>c.cardNumber==='BS12-105').imageUrl
const state = page => page.evaluate(() => {
  const side = id => {
    const field = document.querySelector(`.battle-row[data-animation-player="${id}"]`)
    return { deck: Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      hand: Number(field?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1] ?? 0),
      handIds: [...(field?.querySelectorAll('.hand-card-wrap') ?? [])].map(n => n.getAttribute('data-card-instance-id')),
      breakLevel: Number(field?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), attack: Number(n.querySelector('.badge-atk')?.textContent), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { own: side('player-one'), enemy: side('player-two') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, rawSteps:e.steps, steps: (e.steps ?? []).map(s => typeof s === 'string' ? s : s.text) })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const fixtures = ['positive','two-black','single-black','rested-witness','rested-defender','yellow-arena','black-non-arena','split','hand-only','support-only','trash-only','break-only','opponent-only','wrong-energy','rested-energy','no-energy','spare-energy','disabled','used','main','after-battle','one-opponent','other-black','other-yellow','other-green','other-purple','other-red','flip','faint','replacement','refresh']
const extras = ['zero','other','skip','cancel-payment','cancel-target','back-payment','payment-deselect','target-deselect','skip-target','minimize','over-select','reverse-payment','source-preview','flip-skip','flip-self','flip-zero','replacement-skip','refresh-skip']
const blocked = new Set(['wrong-energy','rested-energy','no-energy','disabled','used','main','after-battle'])
const unmet = new Set(['yellow-arena','black-non-arena','split','hand-only','support-only','trash-only','break-only','opponent-only'])
const skipped = new Set(['skip','cancel-payment','cancel-target'])
const zero = new Set(['zero','skip-target'])
const route = s => s.startsWith('flip-') ? 'flip' : s === 'replacement-skip' ? 'replacement' : s === 'refresh-skip' ? 'refresh' : s === 'source-preview' ? 'main' : fixtures.includes(s) ? s : 'positive'
const browser = await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)})
const results=[]
try {
  for(const viewport of [{width:1280,height:720},{width:1164,height:777}].filter(v=>!process.env.BS12_BROWSER_WIDTHS||process.env.BS12_BROWSER_WIDTHS.split(',').includes(String(v.width)))) for(const scenario of [...fixtures,...extras].filter(s=>!process.env.BS12_BROWSER_CASES||process.env.BS12_BROWSER_CASES.split(',').includes(s))){
    const page=await browser.newPage({viewport}),row={number:'BS12-105',scenario,viewport,printedSourceAttested:true,status:'FAIL',errors:[],networkFailures:[],unmountedImageRequests:[]}
    page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text())})
    page.on('requestfailed',r=>{
      const entry={url:r.url(),error:r.failure()?.errorText}
      // React replaces transient revealed-HP/trash faces during accelerated
      // fixture damage. Browser cancellation of these controlled original-art
      // image requests is retained separately from an actual load failure.
      if(r.resourceType()==='image'&&entry.error==='net::ERR_ABORTED'&&art.some(a=>a.record.imageUrl===entry.url))row.unmountedImageRequests.push(entry)
      else row.networkFailures.push(entry)
    })
    const shot=label=>page.screenshot({path:resolve(out,`${scenario}-${viewport.width}-${label}.png`)})
    try {
      for(const a of art)await page.route(a.record.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(a.path)}))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:BS12-105':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='split'?'card-negative:BS12-105':'bs12-105:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor();await settle(page)
      const initialArt=page.locator(`img[alt="${name}"]`).first()
      await initialArt.evaluate(img=>img.decode());assert.equal(await initialArt.getAttribute('src'),sourceArt);row.originalArtVisible=true
      row.before=await state(page);row.beforeTrace=await trace(page)
      const modal=page.locator('.trap-response-modal:visible')
      if(blocked.has(route(scenario))){
        assert.equal(await modal.count(),0)
        if(scenario==='disabled')await page.getByRole('button',{name:'了解，繼續傷害結算',exact:true}).click()
        if(['disabled','used'].includes(scenario))await page.waitForFunction(hp=>document.querySelector('[data-card-instance-id="bs12-105-defender"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`),scenario==='disabled'?1:2)
        else if(!['main','after-battle','source-preview'].includes(scenario)){await page.waitForFunction(()=>!document.querySelector('[data-card-instance-id="bs12-105-defender"]'));await page.getByRole('button',{name:'不補餅乾',exact:true}).click()}
        await settle(page);row.after=await state(page)
        assert.equal(row.after.own.hand,1);assert.equal(row.after.own.deck,12)
        assert.deepEqual(row.after.own.support.map(s=>s.rested),row.before.own.support.map(s=>s.rested))
        assert.deepEqual(row.after.enemy.battle.map(c=>c.attack),scenario==='disabled'?[3,1]:scenario==='used'?[2,1]:[4,1]);if(['disabled','used'].includes(scenario))assert.equal(row.after.own.battle.find(c=>c.id==='bs12-105-defender').hp,scenario==='disabled'?1:2)
        const blockedTrace=await trace(page);assert.deepEqual(blockedTrace.slice(0,row.beforeTrace.length),row.beforeTrace)
        if(scenario==='disabled')assert.deepEqual(blockedTrace.map(e=>e.commandKind),['declare-attack',...Array(4).fill('resolve-next-damage'),'declare-attack',...Array(3).fill('resolve-next-damage')])
        else if(scenario==='used')assert.deepEqual(blockedTrace.map(e=>e.commandKind),['declare-attack','play-trap',...Array(2).fill('resolve-next-damage')])
        else assert.deepEqual(blockedTrace,row.beforeTrace)
        if(['disabled','used'].includes(scenario))assert.equal(row.after.own.trash,3)
        if(scenario==='source-preview'){
          await page.getByRole('button',{name,exact:true}).click()
          const detail=page.getByRole('dialog',{name:`${name} 卡牌詳情`,exact:true});await detail.waitFor()
          assert.match(await detail.innerText(),/BS12-105/);assert.match(await detail.innerText(),/Cookie in your battle area/);assert.ok(await detail.locator('img[alt="黑色能量"]').count()>0)
          await detail.locator(`img[alt="${name}"]`).evaluate(img=>img.decode());assert.equal(await detail.locator(`img[alt="${name}"]`).getAttribute('src'),sourceArt)
          row.originalArtVisible=true;await shot('source');await detail.getByRole('button',{name:'關閉',exact:true}).click()
          assert.deepEqual(await state(page),row.after)
        }
      }else{
        await modal.waitFor();await modal.locator('.modal-card-options > button').filter({hasText:name}).click()
        const source=modal.locator(`.trap-selected-card-detail img[alt="${name}"]`)
        await source.evaluate(img=>img.decode());assert.equal(await source.getAttribute('src'),sourceArt);row.originalArtVisible=true
        const payments=modal.locator('.trap-guided-section .trap-discard-options > button'),next=modal.getByRole('button',{name:'下一步',exact:true})
        assert.equal(await payments.count(),scenario==='spare-energy'?3:2)
        assert.equal(await next.isEnabled(),false)
        if(['skip','cancel-payment'].includes(scenario))await modal.getByRole('button',{name:'不發動',exact:true}).click()
        else{
          const paymentIndex=scenario==='reverse-payment'?1:0
          await payments.nth(paymentIndex).click();assert.equal(await next.isEnabled(),true)
          if(scenario==='payment-deselect'){await payments.nth(paymentIndex).click();assert.equal(await next.isEnabled(),false);await payments.nth(paymentIndex).click()}
          const preview={...row.before,own:{...row.before.own,support:row.before.own.support.map((s,i)=>({...s,rested:s.rested||i===paymentIndex}))}}
          assert.deepEqual(await state(page),preview);assert.deepEqual(await trace(page),row.beforeTrace)
          await next.click()
          if(scenario==='back-payment'){await modal.getByRole('button',{name:'上一步',exact:true}).click();assert.equal(await next.isEnabled(),true);await next.click()}
          assert.match(await modal.innerText(),/同時是黑色與【Arena】/);assert.match(await modal.innerText(),/本回合攻擊傷害 -2/)
          const targets=modal.locator('.trap-effect-target-step .trap-target-options > button')
          assert.equal(await targets.count(),unmet.has(scenario)?0:scenario==='one-opponent'?1:2)
          if(unmet.has(scenario))assert.equal(await modal.locator('.trap-target-options > button').count(),0)
          const confirm=modal.getByRole('button',{name:'確認發動',exact:true});assert.equal(await confirm.isEnabled(),true)
          const selectedOther=scenario==='other'||scenario.startsWith('other-')||scenario==='over-select'
          if(unmet.has(scenario))assert.match(await modal.locator('.trap-zero-effect-warning').innerText(),/條件不成立/)
          else if(!zero.has(scenario))await targets.nth(selectedOther?1:0).click()
          if(scenario==='target-deselect'){await targets.first().click();assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(),0);await targets.first().click()}
          if(scenario==='over-select'){await targets.first().click();assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(),1);await targets.nth(1).click()}
          if(scenario==='skip-target'){await targets.first().click();await modal.getByRole('button',{name:'略過第 1 段效果',exact:true}).click();assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(),0)}
          if(scenario==='minimize'){await modal.getByRole('button',{name:'縮小',exact:true}).click();await page.locator('.decision-reveal-dock').click();assert.equal(await modal.locator('.trap-target-options > button.is-selected').count(),1)}
          const box=await modal.boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1)
          assert.deepEqual(await state(page),preview);assert.deepEqual(await trace(page),row.beforeTrace);await shot('target')
          await modal.getByRole('button',{name:scenario==='cancel-target'?'不發動':'確認發動',exact:true}).click()
        }
        await modal.waitFor({state:'hidden'})
        let healing=0,healSelf=false
        if(route(scenario)==='flip'||route(scenario)==='refresh'){
          const flip=page.locator('.flip-response-modal');await flip.waitFor();await shot('flip')
          if(['flip-skip','refresh-skip'].includes(scenario))await flip.getByRole('button',{name:'不發動',exact:true}).click()
          else{
            const activate=flip.getByRole('button',{name:'發動 FLIP',exact:true});assert.equal(await activate.isEnabled(),false)
            await flip.locator('.modal-card-options > button').click()
            healSelf=route(scenario)==='refresh'||scenario==='flip-self'
            if(scenario!=='flip-zero'){await flip.locator('.flip-choice-options[aria-label="FLIP 效果目標"] > button').nth(healSelf?0:1).click();healing=1}
            assert.equal(await activate.isEnabled(),true);await shot('flip-selection');await activate.click()
          }
          if(route(scenario)==='refresh'&&healing){const refresh=page.locator('.decision-modal:visible');await refresh.waitFor();assert.match(await refresh.innerText(),/牌庫 Refresh/);await shot('refresh');await refresh.getByRole('button').filter({hasText:'Peach Cookie'}).click()}
        }
        if(route(scenario)==='replacement'||scenario==='hand-only'){
          const replacement=page.locator('.decision-modal:visible');await replacement.waitFor();assert.match(await replacement.innerText(),/補/);await shot('replacement')
          if(scenario==='replacement')await replacement.getByRole('button').filter({hasText:'Subtle Jasmine Cake Hound'}).click()
          else await page.getByRole('button',{name:'不補餅乾',exact:true}).click()
        }
        const activated=!skipped.has(scenario),selectedOther=scenario==='other'||scenario.startsWith('other-')||scenario==='over-select'
        const damage=activated&&!zero.has(scenario)&&!selectedOther&&!unmet.has(scenario)?2:4
        const small=['faint','replacement','refresh'].includes(route(scenario))
        const initialHP=small?2:4,finalHP=initialHP-damage+(healSelf?healing:0)
        await page.waitForFunction(({hp})=>{const c=document.querySelector('[data-card-instance-id="bs12-105-defender"]');return hp<=0?!c:c?.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${hp} 張`)},{hp:finalHP})
        if(finalHP<=0&&!['replacement','replacement-skip','hand-only'].includes(scenario))await page.getByRole('button',{name:'不補餅乾',exact:true}).click()
        await settle(page);row.after=await state(page)
        assert.equal(row.after.own.battle.find(c=>c.id==='bs12-105-defender')?.hp,finalHP<=0?undefined:finalHP)
        const witnessHP=row.before.own.battle.find(c=>c.id==='bs12-105-witness')?.hp
        assert.equal(row.after.own.battle.find(c=>c.id==='bs12-105-witness')?.hp,witnessHP===undefined?undefined:witnessHP+(!healSelf?healing:0))
        if(scenario==='replacement')assert.equal(row.after.own.battle.find(c=>c.id==='bs12-105-replacement')?.hp,2)
        assert.equal(row.after.own.deck,route(scenario)==='refresh'?(healing?9:1):scenario==='replacement'?10:12-healing)
        assert.equal(row.after.own.trash,route(scenario)==='refresh'&&healing?1:row.before.own.trash+Math.min(initialHP+(healSelf?healing:0),damage)+(activated?1:0)+((route(scenario)==='flip'||route(scenario)==='refresh')&&!['flip-skip','refresh-skip'].includes(scenario)?1:0))
        assert.equal(row.after.own.hand,row.before.own.hand-(activated?1:0)-((route(scenario)==='flip'||route(scenario)==='refresh')&&!['flip-skip','refresh-skip'].includes(scenario)?1:0)-(scenario==='replacement'?1:0))
        assert.deepEqual(row.after.own.support.map(s=>s.rested),row.before.own.support.map((s,i)=>s.rested||(activated&&i===(scenario==='reverse-payment'?1:0))))
        assert.deepEqual(row.after.enemy.support,row.before.enemy.support);assert.deepEqual(row.after.enemy.battle.map(c=>c.hp),row.before.enemy.battle.map(c=>c.hp))
        assert.deepEqual(row.after.enemy.battle.map(c=>c.attack),row.before.enemy.battle.map((c,i)=>Math.max(0,c.attack-(activated&&!zero.has(scenario)&&!unmet.has(scenario)&&i===(selectedOther?1:0)?2:0))))
        row.trace=await trace(page);assert.equal(row.trace.filter(e=>e.commandKind==='play-trap').length,activated?1:0)
        if(activated){
          const text=row.trace.find(e=>e.commandKind==='play-trap').steps.join(' ');assert.match(text,/支付能量/)
          assert.match(text,unmet.has(scenario)?/條件不成立，未套用/:zero.has(scenario)?/未選擇餅乾，未套用/:/攻擊傷害 -2.*本回合有效/)
          if(['positive','split','zero','other','refresh'].includes(scenario)){
            await page.getByRole('button',{name:'對戰紀錄',exact:true}).click()
            const log=page.getByRole('complementary',{name:'對戰紀錄側欄',exact:true})
            const declaration=row.trace.findLast(e=>e.commandKind==='declare-attack');assert.ok(declaration);await log.locator('.battle-log-entry').filter({hasText:declaration.summary}).first().click();row.visiblePublicLog=await log.innerText();assert.match(row.visiblePublicLog,/發動陷阱卡：「Perfect Stage」/);assert.match(row.visiblePublicLog,/支付能量（橫置）/)
            await log.locator('img').evaluateAll(async images=>Promise.all(images.map(img=>img.decode())))
            assert.match(row.visiblePublicLog,unmet.has(scenario)?/條件不成立，未套用/:zero.has(scenario)?/未選擇餅乾，未套用/:/攻擊傷害 -2/)
            await shot('log');await log.getByRole('button',{name:'關閉對戰紀錄',exact:true}).click()
          }
        }
      }
      await page.locator('img:visible').evaluateAll(async images=>Promise.all(images.map(img=>img.decode())))
      assert.deepEqual(row.errors,[])
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
      assert.deepEqual(row.networkFailures, []);await shot('result');row.status='PASS'
      console.log(`PASS BS12-105 ${scenario} ${viewport.width}x${viewport.height}`)
    }catch(error){row.error=String(error.stack??error);row.dom=await page.locator('body').innerText().catch(()=>'');await shot('failed').catch(()=>{});throw error}
    finally{results.push(row);writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2));await page.close()}
  }
  console.log(`BS12-105 Browser ${results.length}/${results.length}`)
}finally{await browser.close()}
