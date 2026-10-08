import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
const number=process.env.BS12_BROWSER_CARD
assert.ok(['BS12-035','BS12-035@1','BS12-072','BS12-072@1'].includes(number))
assert.ok(process.env.BS12_BROWSER_OUTPUT)
const out=resolve(process.env.BS12_BROWSER_OUTPUT)
assert.equal(existsSync(out),false,'Preserve every earlier Browser result')
mkdirSync(out,{recursive:true})
const records=[...JSON.parse(readFileSync('data/candidates/official-festival-arena-bs12.en.json')).cards,
 ...readdirSync('data/cards').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('data/cards/'+f)).cards??[])]
const art=records.filter(c=>existsSync(`test-results/bs12-official-art/${c.cardNumber}.webp`))
const is035=number.startsWith('BS12-035')
const cases=is035?['four','original','zero','three','non-arena','opponent','level','faints','deselect','cancel-attack']:
 ['positive','red','yellow','green','purple','black','level-one','level-three','non-arena','item','faints','cost-cookie','cost-stage','cost-trap','skip','no-hand','wrong-energy','one-energy','back','deselect','cancel-attack']
const read=page=>page.evaluate(()=>{
 const side=name=>{const f=document.querySelector('.'+name+'-field');return {
  deck:Number(f.querySelector('.deck-zone .resource-summary>strong')?.textContent),trash:Number(f.querySelector('.discard-zone.resource-summary>strong')?.textContent),
  hand:f.querySelectorAll('.hand-card-wrap').length,breakLevel:Number(f.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]),
  battle:[...f.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1])}))}}
 return {own:side('bottom'),foe:side('top')}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({id:e.id,kind:e.commandKind,steps:e.steps})))
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]'))
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
const results=[]
try{
 for(const viewport of [{width:1280,height:720},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),row={number,scenario,viewport,status:'FAIL',errors:[]}
  page.on('pageerror',e=>row.errors.push(e.message))
  try{
   for(const c of art)await page.route(c.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(`test-results/bs12-official-art/${c.cardNumber}.webp`)}))
   const fixture=is035?(['original','zero','deselect','cancel-attack'].includes(scenario)?'four':scenario):(['skip','back','deselect','cancel-attack'].includes(scenario)?'positive':scenario)
   row.fixture=number.toLowerCase()+':then-'+fixture
   await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.fixture+'&contract-card='+number+','+number.split('@')[0]+',bs12-035-source,bs12-072-source,r004-cost,r004-bottom')
   await page.locator('.game-shell').waitFor()
   await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'})
   row.before=await read(page);row.setupTrace=await trace(page)
   const source=page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${is035?'bs12-035-source':'bs12-072-source'}"]`)
   await source.locator('img').first().evaluate(i=>i.decode())
   assert.equal(await source.locator('img').first().getAttribute('src'),records.find(c=>c.cardNumber===number).imageUrl)
   if(['wrong-energy','one-energy'].includes(scenario)){
    assert.equal(await source.locator('.card-face.is-attackable').count(),0)
    assert.deepEqual(await read(page),row.before)
   }else{
    await source.locator('.card-face.is-attackable').click()
    const support=page.locator('.bottom-field .support-card-wrap .card-face')
    for(let i=0;i<(is035?1:2);i++)await support.nth(i).click({position:{x:10,y:25}})
    if(scenario==='cancel-attack'){
     await page.getByRole('button',{name:'取消攻擊',exact:true}).click()
     assert.deepEqual(await read(page),row.before)
    }else{
     await page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${is035?'bs12-035-opponent':'bs12-064-opponent'}"]`).getByRole('button',{name:/^選擇攻擊目標/}).click()
     await page.waitForFunction(({faints,hp})=>{const b=[...document.querySelectorAll('.top-field .combat-card-wrap')];return faints?b.length===1:Number(b[0]?.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1])===hp},{faints:scenario==='faints',hp:is035?5:4})
     await settle(page)
     if(is035){
      const modal=page.locator('.effect-panel:not(.is-complete):visible')
      const enabled=['four','original','zero','faints','deselect'].includes(scenario)
      if(enabled)await modal.waitFor();
      if(!enabled)await page.waitForFunction(()=>!document.querySelector('.effect-panel:not(.is-complete),.match-animation-layer[data-playing="true"]')&&[...document.querySelectorAll('button')].some(b=>b.textContent==='結束主要階段'&&!b.disabled))
      row.ordinary=await read(page)
      const targetId=scenario==='original'?'bs12-035-opponent':'bs12-035-opponent-other'
      if(enabled&&scenario!=='zero'){
       const target=modal.getByRole('button').filter({hasText:scenario==='original'?'Sugar Swan Cookie':'Candy Diver Cookie'})
       await target.click()
       if(scenario==='deselect'){await target.click();await target.click()}
      }
      assert.deepEqual(await read(page),row.ordinary)
      if(enabled)await modal.getByRole('button',{name:'確認發動',exact:true}).click()
      await page.getByRole('button',{name:'結束主要階段',exact:true}).waitFor()
      row.after=await read(page)
      assert.deepEqual(row.after.foe.battle.map(c=>c.hp),scenario==='faints'?[2]:[scenario==='original'?4:5,enabled&&scenario!=='zero'&&scenario!=='original'?2:3])
      assert.deepEqual(row.after.own,row.ordinary.own)
     }else{
      const panel=page.locator('.optional-cost-attack-inline:visible,.optional-cost-attack-modal:visible')
      await panel.waitFor();assert.match(await panel.innerText(),/棄置 1 張手牌、展示 1 張牌庫底卡/);row.ordinary=await read(page)
      assert.deepEqual(row.ordinary.foe.battle.map(c=>c.hp),scenario==='faints'?[4]:[4,4])
      if(['skip','no-hand'].includes(scenario)){
       if(scenario==='no-hand')assert.equal(await panel.getByRole('button',{name:'支付',exact:true}).isEnabled(),false)
       await panel.getByRole('button',{name:'略過',exact:true}).click()
       assert.deepEqual(await read(page),row.ordinary)
      }else{
       await panel.getByRole('button',{name:'支付',exact:true}).click()
       const confirm=panel.getByRole('button',{name:'確認',exact:true})
       assert.equal(await confirm.isEnabled(),false)
       if(scenario==='back'){await panel.getByRole('button',{name:'返回',exact:true}).click();assert.deepEqual(await read(page),row.ordinary);await panel.getByRole('button',{name:'支付',exact:true}).click()}
       const cost=panel.locator('.optional-cost-discard-options button,.modal-card-options button').first()
       await cost.click()
       if(scenario==='deselect'){await cost.click();assert.equal(await confirm.isEnabled(),false);await cost.click()}
       assert.deepEqual(await read(page),row.ordinary)
       await confirm.click()
       const reveal=page.locator('.card-reveal-modal:visible');await reveal.waitFor();row.paid=await read(page)
       assert.equal(row.paid.own.hand,row.ordinary.own.hand-1)
       assert.equal(row.paid.own.trash,row.ordinary.own.trash+1)
       assert.deepEqual(row.paid.foe,row.ordinary.foe)
       const mismatch=['level-one','level-three','non-arena','item'].includes(scenario)
       assert.match(await reveal.innerText(),mismatch?/條件未匹配/:/條件匹配/)
       await reveal.getByRole('button',{name:'確認並繼續',exact:true}).click()
       if(!mismatch&&scenario!=='faints'){
        const effect=page.locator('.effect-panel:not(.is-complete):visible');await effect.waitFor()
        const targets=effect.locator('.effect-candidates-target button')
        assert.equal(await targets.count(),1);assert.match(await targets.first().innerText(),/Sugar Swan Cookie/)
        assert.equal(await effect.getByRole('button').filter({hasText:'Melon Soda Cookie AI 對手・戰鬥區'}).count(),0)
        await targets.first().click()
        await effect.getByRole('button',{name:'確認發動',exact:true}).click()
       }
       await page.getByRole('button',{name:'結束主要階段',exact:true}).waitFor()
       row.after=await read(page)
       assert.equal(row.after.own.deck,row.before.own.deck-(mismatch?0:1))
       assert.equal(row.after.own.hand,mismatch?0:1)
       assert.deepEqual(row.after.foe.battle.map(c=>c.hp),scenario==='faints'?[4]:[mismatch?4:3,4])
      }
     }
    }
   }
   row.after??=await read(page)
   row.trace=(await trace(page)).filter(e=>!row.setupTrace.some(s=>s.id===e.id))
   const attacked=!['wrong-energy','one-energy','cancel-attack'].includes(scenario)
   assert.equal(row.trace.some(e=>e.kind==='declare-attack'),attacked)
   if(attacked&&!is035&&!['skip','no-hand'].includes(scenario)){
    const kinds=row.trace.map(e=>e.kind)
    assert.ok(kinds.indexOf('resolve-optional-cost-attack')>kinds.indexOf('declare-attack'))
    assert.ok(kinds.indexOf('resolve-reveal-top-deck')>kinds.indexOf('resolve-optional-cost-attack'))
   }
   row.art=await page.evaluate(async urls=>Promise.all([...document.images].filter(i=>urls.includes(i.src)).map(async i=>{await i.decode();return {url:i.src,width:i.naturalWidth}})),art.map(c=>c.imageUrl))
   assert.ok(row.art.every(i=>i.width>0));assert.deepEqual(row.errors,[])
   await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}.png`)})
   row.status='PASS';console.log('PASS',number,scenario,viewport.width)
  }catch(e){row.error=String(e);await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}-failed.png`)});throw e}
  finally{results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));await page.close()}
 }
}finally{await browser.close()}
