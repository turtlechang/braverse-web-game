import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
const number=process.env.BS12_BROWSER_CARD, out=resolve(process.env.BS12_BROWSER_OUTPUT??'')
assert.ok(['BS12-036','BS12-036@1','BS12-082','BS12-109','BS12-109@1','BS12-109@2'].includes(number))
assert.ok(process.env.BS12_BROWSER_OUTPUT); assert.equal(existsSync(out),false,'Preserve earlier results'); mkdirSync(out,{recursive:true})
const records=[...JSON.parse(readFileSync('data/candidates/official-festival-arena-bs12.en.json')).cards,...readdirSync('data/cards').filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync('data/cards/'+f)).cards??[])]
const art=records.filter(c=>existsSync(`test-results/bs12-official-art/${c.cardNumber}.webp`))
const traceCards=records.filter(c=>c.cardNumber.startsWith('BS12-')||['BS6-008','ST4-001','BS11-111'].includes(c.cardNumber)).map(c=>c.cardNumber)
const nonArenaName=records.find(c=>c.cardNumber==='BS11-111').name
const clotted=number.startsWith('BS12-036'), dj=number==='BS12-082'
const cases=clotted?['positive','rested','same-number','same-alt','red','green','blue','purple','black','no-target','non-arena-cost','no-cost','zero','skip','back','deselect','cancel-attack']:
 dj?['positive','cookie','item','stage','trap','rested','original','one-card','cancel-tax','cancel-payment','deselect','back']:
 ['positive','source','one-hp','rested','two-support','no-special','non-arena-special','zero','deselect','cancel-attack','rested-energy','attack-wrong-energy','public-art']
const read=page=>page.evaluate(()=>{
 const side=name=>{const f=document.querySelector('.'+name+'-field');return{hand:f.querySelectorAll('.hand-card-wrap').length,deck:Number(f.querySelector('.deck-zone .resource-summary>strong')?.textContent),trash:Number(f.querySelector('.discard-zone.resource-summary>strong')?.textContent),support:[...f.querySelectorAll('.support-card-wrap .card-face')].map(c=>c.classList.contains('is-rested')),battle:[...f.querySelectorAll('.combat-card-wrap')].map(c=>({id:c.getAttribute('data-card-instance-id'),hp:Number(c.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1])}))}}
 return{own:side('bottom'),foe:side('top')}
})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({id:e.id,kind:e.commandKind,steps:e.steps,summary:e.summary})))
const end=page=>page.waitForFunction(()=>!document.querySelector('.optional-cost-attack-inline,.optional-cost-attack-modal,.effect-panel:not(.is-complete),.hand-discard-modal,.match-animation-layer[data-playing="true"]')&&[...document.querySelectorAll('button')].some(b=>b.textContent==='結束主要階段'&&!b.disabled))
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[]
try{
 for(const viewport of [{width:1280,height:720},{width:1164,height:777}])for(const scenario of cases){
  const page=await browser.newPage({viewport}),row={number,scenario,viewport,status:'FAIL',errors:[]}
  page.on('pageerror',e=>row.errors.push(e.message))
  try{
   for(const c of art)await page.route(c.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(`test-results/bs12-official-art/${c.cardNumber}.webp`)}))
   const fixture=clotted?'then-'+(['zero','skip','back','deselect','cancel-attack'].includes(scenario)?'positive':scenario):dj?(scenario==='one-card'?'multiple-source':'multi-'+(['cancel-tax','cancel-payment','deselect','back'].includes(scenario)?'positive':scenario)):(['rested-energy','attack-wrong-energy'].includes(scenario)?scenario:'then-'+(['zero','deselect','cancel-attack','public-art'].includes(scenario)?'positive':scenario))
   row.route=number.toLowerCase()+':'+fixture
   await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.route+'&contract-card='+traceCards.join(','))
   await page.locator('.game-shell').waitFor();await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'})
   row.before=await read(page);row.setupTrace=await trace(page)
   if(dj){
    assert.deepEqual(row.before.foe.battle.map(c=>c.hp),[2,2])
    const hand=page.locator('.bottom-field .hand-card-wrap').filter({has:page.locator(`img[alt="${scenario==='original'?'Luxury Red Carpet':'Sweet Jams Guitar'}"]`)}).first()
    await hand.locator('button.card-face').click();const use=hand.getByRole('button',{name:'使用',exact:true})
    if(scenario==='one-card'){assert.ok(await use.count()===0||!await use.isEnabled());assert.deepEqual(await read(page),row.before)}
    else{
     await use.click();const dialog=page.getByRole('alertdialog')
     await dialog.locator('.effect-candidates-payment button').first().click()
     if(scenario==='cancel-payment'){await dialog.getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await read(page),row.before)}
     else{
      await dialog.getByRole('button',{name:'下一步',exact:true}).click()
      if(scenario==='back'){
       await dialog.getByRole('button',{name:'上一步',exact:true}).click()
       assert.deepEqual(await trace(page),row.setupTrace)
       assert.deepEqual(await read(page),{...row.before,own:{...row.before.own,support:row.before.own.support.map(()=>true)}})
       await dialog.getByRole('button',{name:'下一步',exact:true}).click()
      }
      if(scenario==='original')await dialog.getByRole('button',{name:/Gnome Band Gnome Band/}).click()
      const receiver=dialog.getByRole('button',{name:/Langue de Chat Cookie Langue de Chat Cookie 玩家・戰鬥區第 1 張/})
      if(await receiver.count())await receiver.click()
      await dialog.getByRole('button',{name:'確認發動',exact:true}).click()
      const tax=page.locator('.hand-discard-modal');await tax.waitFor();assert.match(await tax.innerText(),/必須選擇 2 張手牌/)
      assert.deepEqual(await read(page),row.before)
      const confirm=tax.getByRole('button',{name:/確認棄置/});assert.equal(await confirm.isEnabled(),false)
      if(scenario==='cancel-tax'){await tax.getByRole('button',{name:'取消使用道具',exact:true}).click();assert.deepEqual(await read(page),row.before)}
      else{
       const options=tax.locator('.hand-discard-card-option>button');assert.equal(await options.count(),2)
       await options.nth(0).click();assert.equal(await confirm.isEnabled(),false)
       if(scenario==='deselect'){await options.nth(0).click();assert.equal(await confirm.isEnabled(),false);await options.nth(0).click()}
       await options.nth(1).click();assert.equal(await confirm.isEnabled(),true)
       assert.deepEqual(await read(page),row.before);await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}-unpaid.png`)})
       await confirm.click();await page.waitForFunction(()=>Number(document.querySelector('.bottom-field .discard-zone.resource-summary>strong')?.textContent)===3)
       row.paid=await read(page);assert.equal(row.paid.own.hand,0);assert.equal(row.paid.own.trash,3);assert.ok(row.paid.own.support.every(Boolean));assert.deepEqual(row.paid.foe,row.before.foe)
       if(scenario==='original'){
        await page.waitForFunction(()=>document.querySelector('.effect-panel:not(.is-complete),.draw-up-to-modal'))
        const effect=page.locator('.effect-panel:not(.is-complete):visible')
        if(await effect.count())await effect.getByRole('button',{name:'確認發動',exact:true}).click()
        const draw=page.locator('.draw-up-to-modal:visible');await draw.waitFor()
        await draw.locator('.draw-up-to-option').filter({hasText:'不抽'}).click();await draw.getByRole('button',{name:'略過抽牌',exact:true}).click()
       }
       await end(page)
      }
     }
    }
   }else{
    const sourceId=clotted?'bs12-036-source':'final-source',foeId=clotted?'bs12-036-opponent':'final-enemy'
    const source=page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${sourceId}"]`)
    assert.equal(await source.locator('img').first().getAttribute('src'),records.find(c=>c.cardNumber===number).imageUrl)
    if(clotted){assert.equal(row.before.own.battle.find(c=>c.id===sourceId).hp,6);assert.deepEqual(row.before.foe.battle.map(c=>c.hp),[6,3]);assert.ok(row.setupTrace.some(e=>e.kind==='play-extra-deck-cookie'))}
    else{assert.deepEqual(row.before.foe.battle.map(c=>c.hp),[4,3]);assert.equal(row.before.own.battle[0].hp,2)}
    if(['rested-energy','attack-wrong-energy'].includes(scenario)){assert.equal(await source.locator('.card-face.is-attackable').count(),0);assert.deepEqual(await read(page),row.before)}
    else{
     await source.locator('.card-face.is-attackable').click()
     const supports=page.locator('.bottom-field .support-card-wrap .card-face');for(let i=0;i<(clotted?3:2);i++)await supports.nth(i).click({position:{x:10,y:25}})
     if(scenario==='cancel-attack'){await page.getByRole('button',{name:'取消攻擊',exact:true}).click();assert.deepEqual(await read(page),row.before)}
     else{
      await page.locator(`.top-field .combat-card-wrap[data-card-instance-id="${foeId}"]`).getByRole('button',{name:/^選擇攻擊目標/}).click()
      await page.waitForFunction(hp=>Number(document.querySelector('.top-field .combat-card-wrap .hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1])===hp,clotted?3:2)
      row.ordinary=await read(page)
      if(clotted){
       const panel=page.locator('.optional-cost-attack-inline:visible,.optional-cost-attack-modal:visible');await panel.waitFor()
       assert.match(await panel.innerText(),/己方戰鬥區.*來源以外.*支付後再選擇效果目標/)
       if(['non-arena-cost','no-cost'].includes(scenario)){assert.equal(await panel.getByRole('button',{name:'支付',exact:true}).isEnabled(),false);await panel.getByRole('button',{name:'略過',exact:true}).click()}
       else if(scenario==='skip')await panel.getByRole('button',{name:'略過',exact:true}).click()
       else{
        await panel.getByRole('button',{name:'支付',exact:true}).click()
        const cost=panel.locator('.optional-cookie-break-cost .modal-card-options>button'),confirm=panel.getByRole('button',{name:'確認',exact:true})
        assert.equal(await cost.count(),1);assert.equal(await confirm.isEnabled(),false)
        await cost.click();if(scenario==='deselect'){await cost.click();assert.equal(await confirm.isEnabled(),false);await cost.click()}
        if(scenario==='back'){await panel.getByRole('button',{name:'返回',exact:true}).click();assert.deepEqual(await read(page),row.ordinary);await panel.getByRole('button',{name:'支付',exact:true}).click();await cost.click()}
        assert.deepEqual(await read(page),row.ordinary);await confirm.click()
        const effect=page.locator('.effect-panel:not(.is-complete):visible');await effect.waitFor();row.paid=await read(page)
        assert.deepEqual(row.paid.own.battle,[{id:sourceId,hp:6}]);assert.equal(row.paid.own.trash,row.ordinary.own.trash+2);assert.equal(await page.getByRole('button',{name:'不補餅乾',exact:true}).count(),0)
        const options=effect.locator('.effect-candidates-target button')
        if(['same-number','same-alt'].includes(scenario))assert.equal(await options.filter({hasText:'Caramel Choux Cookie'}).count(),0)
        if(scenario==='no-target')assert.equal(await options.count(),0)
        if(!['zero','same-number','same-alt','no-target'].includes(scenario)){
         const target=options.filter({hasText:({red:'Peach Cookie',green:'Clover Cookie',blue:'Ice Pop Cookie',purple:'Currant Cream Cookie',black:'Subtle Jasmine Cake Hound'})[scenario]??'Madeleine Cookie'})
         assert.equal(await target.count(),1);await target.click()
        }
        await effect.getByRole('button',{name:'確認發動',exact:true}).click()
        if(['same-number','same-alt'].includes(scenario)){
         await page.getByRole('heading',{name:'Caramel Choux Cookie 發動休息區移入效果',exact:true}).waitFor()
         await page.locator('.bottom-field').getByRole('button',{name:'Clotted Cream Cookie',exact:true}).click()
         await page.getByRole('button',{name:'確認 (1)',exact:true}).click()
        }
       }
       // A normal nonfaint battle cost records a replacement task after the whole Then/Skill chain.
       // Decline that real task even when the revival has already filled the two battle slots.
       await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='不補餅乾'||(b.textContent==='結束主要階段'&&!b.disabled)))
       const replacement=page.getByRole('button',{name:'不補餅乾',exact:true})
       if(await replacement.count()){row.replacementDeclined=true;await replacement.click()}
       await end(page);row.after=await read(page)
       if(!['non-arena-cost','no-cost','skip','zero','same-number','same-alt','no-target'].includes(scenario))assert.equal(row.after.own.battle.length,2)
       if(['same-number','same-alt'].includes(scenario))assert.deepEqual(row.after.own.battle,[{id:sourceId,hp:7}])
      }else{
       const effect=page.locator('.effect-panel:not(.is-complete):visible')
       if(['two-support','no-special'].includes(scenario)){if(await effect.count())await effect.getByRole('button',{name:'確認發動',exact:true}).click();await end(page);assert.equal((await read(page)).own.hand,row.before.own.hand)}
       else{
        await effect.waitFor();const target=effect.locator('.effect-candidates-target button').filter({hasText:scenario==='source'?'Licorice Cookie':scenario==='one-hp'?'Mayor Cuckoobeans':'Butter Roll Cookie'})
        if(scenario!=='zero'){assert.equal(await target.count(),1);await target.click();if(scenario==='deselect'){await target.click();await target.click()}}
        assert.deepEqual(await read(page),row.ordinary);await effect.getByRole('button',{name:'確認發動',exact:true}).click()
        if(scenario!=='zero'){
         const hand=page.locator('.hand-discard-modal');await hand.waitFor();assert.match(await hand.innerText(),/恰好 1 張手牌/);assert.match(await hand.innerText(),/面朝上，公開內容/);assert.match(await hand.innerText(),/HP 最上方/);assert.match(await hand.innerText(),/Then, if there are 3 cards or more/)
         assert.equal(await hand.getByRole('button',{name:'略過放置',exact:true}).count(),0)
         const options=hand.locator('.hand-discard-options button');assert.equal(await options.count(),2)
         assert.equal(await hand.getByRole('button',{name:/確認放置/}).isEnabled(),false)
         const chosenName=scenario==='non-arena-special'?nonArenaName:'Blueberry Cake Hound'
         const chosen=options.filter({hasText:chosenName});await chosen.click()
         assert.deepEqual(await read(page),row.ordinary);await hand.getByRole('button',{name:/確認放置/}).click();await end(page)
         row.after=await read(page);const targetId=scenario==='source'?'final-source':'final-companion'
         assert.equal(row.after.own.battle.find(c=>c.id===targetId).hp,row.ordinary.own.battle.find(c=>c.id===targetId).hp+1);assert.equal(row.after.own.hand,row.ordinary.own.hand-1);assert.equal(row.after.own.deck,row.ordinary.own.deck)
         const hp=page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${targetId}"] .hp-card-stack`)
         const publicArt=hp.locator(`img[alt="${chosenName}"]`);assert.equal(await publicArt.count(),1)
         if(scenario==='public-art'){
          assert.equal(await publicArt.getAttribute('src'),records.find(c=>c.cardNumber==='BS12-095').imageUrl)
          await publicArt.click();const detail=page.locator('.card-detail-modal');await detail.waitFor()
          assert.match(await detail.innerText(),/BS12-095/);assert.equal(await detail.locator('img[alt="Blueberry Cake Hound"]').getAttribute('src'),records.find(c=>c.cardNumber==='BS12-095').imageUrl)
          await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}-public-detail.png`)})
          await detail.getByRole('button',{name:'關閉',exact:true}).click();await end(page)
         }
        }else{await end(page);assert.deepEqual(await read(page),row.ordinary)}
       }
      }
     }
    }
   }
   row.after??=await read(page);row.trace=(await trace(page)).filter(e=>!row.setupTrace.some(s=>s.id===e.id));assert.deepEqual(row.errors,[])
   if(dj&&!['one-card','cancel-payment','cancel-tax'].includes(scenario))assert.ok(row.trace.some(e=>e.kind==='resolve-opponent-hand-discard'))
   if(!clotted&&!dj&&!['two-support','no-special','zero','cancel-attack','rested-energy','attack-wrong-energy'].includes(scenario))assert.ok(row.trace.some(e=>e.kind==='resolve-place-hand-hp'))
   row.art=await page.evaluate(async urls=>Promise.all([...document.images].filter(i=>urls.includes(i.src)).map(async i=>{await i.decode();return {url:i.src,width:i.naturalWidth}})),art.map(c=>c.imageUrl));assert.ok(row.art.every(i=>i.width>0))
   await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}.png`)});row.status='PASS';console.log('PASS',number,scenario,viewport.width)
  }catch(e){row.error=String(e);row.dom=await page.locator('body').innerText();await page.screenshot({path:resolve(out,`${number}-${scenario}-${viewport.width}-failed.png`)});throw e}
  finally{results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));await page.close()}
 }
}finally{await browser.close()}
