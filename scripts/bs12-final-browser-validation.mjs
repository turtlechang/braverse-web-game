import assert from 'node:assert/strict'
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),require=createRequire(import.meta.url),module=await import(pathToFileURL(require.resolve('playwright',{paths:process.env.PLAYWRIGHT_NODE_MODULES?[process.env.PLAYWRIGHT_NODE_MODULES]:[root]})).href),chromium=module.chromium??module.default?.chromium
const number=process.env.BS12_PRINT_NUMBER;assert.match(number??'',/^BS12-(109(?:@[12])?|110(?:@1)?|111(?:@[123])?|112(?:@1)?)$/);const base=number.split('@')[0];assert.ok(process.env.BS12_BROWSER_OUTPUT);const out=resolve(root,process.env.BS12_BROWSER_OUTPUT);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true})
const records=['data/candidates/official-festival-arena-bs12.en.json',...readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).map(f=>'data/cards/'+f)].flatMap(p=>JSON.parse(readFileSync(resolve(root,p),'utf8')).cards)
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(r=>r.path),source=records.find(r=>r.cardNumber===number);assert.ok(source&&art.some(r=>r.record===source))
const scenes={
 'BS12-109':['positive','few-opponent-support','attack','attack-wrong-energy','rested-energy','deploy','then-positive'],
 'BS12-110':['positive','two-black','mixed-support','rested-source','opponent-turn','outside-main','draw-zero','draw-one','attack','attack-wrong-energy','deploy','single-source','short-deck'],
 'BS12-111':['positive','three-support','no-special','non-arena-special','hand-only','support-only','trash-only','break-only','opponent-only','full-battle','first-player','rested-witness','attack','attack-wrong-energy','attack-first-player'],
 'BS12-112':['positive','special-no-skill','special-wrong-level','special-rested-cost','ordinary','attack','attack-wrong-energy','then-zero','then-one','then-two','new-hp-target','invalid-lv','invalid-non-arena','invalid-non-cookie','single-source','rested-source','deploy'],
},extras={
 'BS12-109':['generic-positive','generic-negative','cancel-attack','deselect-payment','original-hand-preserved'],
 'BS12-110':['generic-positive','generic-negative','cancel-skill','minimize-draw','cancel-attack','deselect-payment'],
 'BS12-111':['generic-positive','generic-negative','close-extra','cancel-attack','deselect-payment'],
 'BS12-112':['generic-positive','generic-negative','special-cancel','special-deselect','then-skip','return-target','minimize-then'],
}
const route=scenario=>scenario==='generic-negative'?base==='BS12-109'?'attack-wrong-energy':base==='BS12-110'?'two-black':base==='BS12-111'?'three-support':'special-no-skill':['cancel-attack','deselect-payment'].includes(scenario)?'attack':extras[base].includes(scenario)?'positive':scenario
const state=page=>page.evaluate(()=>{const side=id=>{const f=document.querySelector('.battle-row[data-animation-player="'+id+'"]');return {deck:Number(f?.querySelector('.deck-zone .resource-summary > strong')?.textContent),trash:Number(f?.querySelector('.discard-zone.resource-summary > strong')?.textContent),hand:Number(f?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1]??0),handIds:[...(f?.querySelectorAll('.hand-card-wrap')??[])].map(n=>n.getAttribute('data-card-instance-id')),breakLevel:Number(f?.querySelector('.break-zone .zone-heading')?.textContent?.match(/LV\.\s*(\d+)/)?.[1]??0),battle:[...(f?.querySelectorAll('.combat-card-wrap')??[])].map(n=>({id:n.getAttribute('data-card-instance-id'),hp:Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1]??0),rested:n.querySelector('.card-face')?.classList.contains('is-rested')??false,attack:Number(n.querySelector('.badge-atk')?.textContent),attackTitle:n.querySelector('.badge-atk')?.getAttribute('title'),text:n.innerText})),support:[...(f?.querySelectorAll('.support-card-wrap')??[])].map(n=>({id:n.getAttribute('data-card-instance-id'),rested:n.querySelector('.card-face')?.classList.contains('is-rested')??false}))}};return {own:side('player-one'),enemy:side('player-two')}})
const trace=page=>page.evaluate(()=>(window.__braverseContractTrace??[]).map(e=>({commandKind:e.commandKind,summary:e.summary,steps:e.steps})))
const settle=page=>page.waitForFunction(()=>!document.querySelector('.match-animation-layer[data-playing="true"]')&&![...document.querySelectorAll('button')].some(b=>b.textContent?.trim()==='略過目前演出'),null,{timeout:20000})
const browser=await chromium.launch({headless:true,executablePath:['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)}),results=[]
try{for(const viewport of [{width:1280,height:720},{width:1164,height:777}])for(const scenario of [...scenes[base],...extras[base]]){
 const page=await browser.newPage({viewport}),fixture=route(scenario),row={number,scenario,fixture,viewport,status:'FAIL',isolated:base==='BS12-109'&&scenario==='then-isolated',printedSourceAttested:true,errors:[],networkFailures:[],cancelledOriginalArtRequests:[]},shot=label=>page.screenshot({path:resolve(out,scenario+'-'+viewport.width+'-'+label+'.png')})
 page.on('pageerror',e=>row.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')row.errors.push(m.text())});page.on('requestfailed',r=>{const failure={url:r.url(),error:r.failure()?.errorText};if(failure.error==='net::ERR_ABORTED'&&art.some(a=>a.record.imageUrl===failure.url))row.cancelledOriginalArtRequests.push(failure);else row.networkFailures.push(failure)})
 const fits=async panel=>{const b=await panel.boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1)}
 const sourceCard=()=>page.locator('[data-card-instance-id="'+(base==='BS12-111'?'final-extra':'final-source')+'"]')
 const attestSource=async locator=>{const img=locator.locator('img').first();assert.equal(await img.getAttribute('src'),source.imageUrl);await img.evaluate(i=>i.decode());row.originalArtVisible=true}
 const skipReplacement=async()=>{const skip=page.getByRole('button',{name:'不補餅乾',exact:true});if(await skip.isVisible()){await skip.click();await settle(page)}}
 const attack=async()=>{
  const before=await state(page),beforeTrace=await trace(page),card=sourceCard(),blocked=['attack-wrong-energy','rested-energy','rested-source'].includes(fixture)
  assert.equal(await card.locator('.card-face.is-attackable').count(),blocked?0:1)
  if(blocked){assert.deepEqual(await state(page),before);assert.deepEqual(await trace(page),beforeTrace);await shot('blocked-attack');return false}
  await card.locator('.card-face.is-attackable').click()
  if(scenario==='cancel-attack'){await page.getByRole('button',{name:'取消攻擊',exact:true}).click();assert.deepEqual(await state(page),before);assert.deepEqual(await trace(page),beforeTrace);return false}
  const count=base==='BS12-112'?3:2
  for(let i=0;i<count;i++)await page.locator('[data-card-instance-id="final-payment-'+i+'"] .card-face').click()
  if(scenario==='deselect-payment'){await page.locator('[data-card-instance-id="final-payment-'+(count-1)+'"] .card-face').click();assert.equal(await page.locator('[data-card-instance-id="final-enemy"] .card-face[aria-label^="選擇攻擊目標："]').count(),0);await page.locator('[data-card-instance-id="final-payment-'+(count-1)+'"] .card-face').click()}
  await page.locator('[data-card-instance-id="final-enemy"] .card-face[aria-label^="選擇攻擊目標："]').click();await settle(page)
  await page.waitForFunction(hp=>document.querySelector('[data-card-instance-id="final-enemy"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 '+hp+' 張'),base==='BS12-112'?1:base==='BS12-110'?3:2)
  row.ordinary=await state(page);assert.equal(row.ordinary.enemy.battle[0].hp,base==='BS12-112'?1:base==='BS12-110'?3:2);assert.ok(row.ordinary.own.support.every(s=>s.rested));return true
 }
 try{
  for(const a of art)await page.route(a.record.imageUrl,r=>r.fulfill({contentType:'image/webp',body:readFileSync(a.path)}))
  row.testState=scenario==='generic-positive'?'card:'+number:scenario==='generic-negative'?'card-negative:'+number:'bs12-'+number.slice(5)+':'+fixture
  await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:4173')+'/?test-state='+row.testState+'&contract-card='+art.map(a=>a.record.cardNumber).join(','));await page.locator('.game-shell').waitFor();await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'});await settle(page);row.before=await state(page);row.beforeTrace=await trace(page)
  if(base==='BS12-111'&&!fixture.startsWith('attack')){
   await page.getByRole('button',{name:'玩家 EXTRA Deck 1 張',exact:true}).click();const extra=page.getByRole('dialog',{name:'玩家 EXTRA Deck',exact:true});await extra.waitFor();await fits(extra);await attestSource(extra);await shot('extra')
   const allowed=['positive','non-arena-special','first-player','rested-witness'].includes(fixture),enter=extra.getByRole('button',{name:'從 EXTRA 登場',exact:true});assert.equal(await enter.count(),allowed?1:0)
   if(scenario==='close-extra'){await page.getByRole('button',{name:'玩家 EXTRA Deck 1 張',exact:true}).click();assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)}
   else if(allowed){await enter.click();await sourceCard().waitFor();await settle(page);row.entered=await state(page);assert.equal(row.entered.own.battle.find(c=>c.id==='final-extra').hp,5);assert.equal(row.entered.own.deck,row.before.own.deck-5);assert.deepEqual(row.entered.own.support,row.before.own.support);const witness=row.entered.own.battle.find(c=>c.id==='final-witness');assert.equal(witness.attack,fixture==='non-arena-special'?2:3);assert.equal(row.entered.own.battle.find(c=>c.id==='final-extra').attack,2);if(fixture!=='non-arena-special')assert.match(witness.attackTitle,/Poison Mushroom Cookie \+1/)}
   else{assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)}
  }else{
   await attestSource(sourceCard())
   if(fixture==='deploy'||fixture==='ordinary'){
    const before=await state(page);await sourceCard().locator('button.card-face').click();await sourceCard().getByRole('button',{name:'登場',exact:true}).click();await sourceCard().locator('.hp-card-stack').waitFor();await settle(page);const after=await state(page),hp=base==='BS12-109'?2:base==='BS12-110'?3:4;assert.equal(after.own.battle.find(c=>c.id==='final-source').hp,hp);assert.equal(after.own.deck,before.own.deck-hp);assert.equal(after.own.hand,before.own.hand-1);assert.deepEqual(after.own.support,before.own.support)
   }else if(base==='BS12-110'&&!fixture.startsWith('attack')){
    const allowed=!['two-black','mixed-support','opponent-turn','outside-main'].includes(fixture),skill=sourceCard().getByRole('button',{name:'啟動技能',exact:true});assert.equal(Boolean(await skill.count()&&await skill.isEnabled()),allowed)
    if(allowed){await skill.click();const panel=page.locator('.effect-panel:not(.is-complete):visible');await panel.waitFor();await fits(panel);await shot('skill-cost');if(scenario==='cancel-skill'){await panel.getByRole('button',{name:'取消技能',exact:true}).click();assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)}else{
     await panel.getByRole('button',{name:'確認發動',exact:true}).click();await settle(page);const draw=page.locator('.draw-up-to-modal:visible');await draw.waitFor();await fits(draw);row.paid=await state(page);assert.ok(!row.paid.own.battle.some(c=>c.id==='final-source'));assert.equal(row.paid.own.trash,4);assert.equal(row.paid.own.breakLevel,row.before.own.breakLevel);const zero=fixture==='draw-zero';if(!zero)await draw.getByRole('button',{name:/^抽 1 張/}).click();if(scenario==='minimize-draw'){await draw.getByRole('button',{name:'縮小',exact:true}).click();await page.locator('.decision-reveal-dock').click();await draw.waitFor()}await shot('draw');await draw.getByRole('button',{name:zero?'略過抽牌':'抽取 1 張牌',exact:true}).click();await settle(page)
     if(fixture==='single-source'){const choice=page.getByRole('alertdialog').locator('.decision-card-options > button');await choice.waitFor();assert.equal(await choice.count(),1);assert.equal(await page.getByRole('button',{name:'不補餅乾',exact:true}).count(),0);await choice.click();await settle(page);const after=await state(page);assert.equal(after.own.battle[0].hp,1);assert.equal(after.own.hand,0);assert.equal(after.own.deck,row.before.own.deck-2)}else{await skipReplacement();const after=await state(page);assert.equal(after.own.hand,zero?0:1);assert.equal(after.own.deck,row.before.own.deck-(zero?0:1));assert.deepEqual(after.own.support,row.before.own.support)}
    }}else{assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace);await shot('blocked-skill')}
   }else{
    let canAttack=true
    if(base==='BS12-112'&&['positive','special-no-skill','special-wrong-level','special-rested-cost'].includes(fixture)){
     await sourceCard().locator('button.card-face').click();const special=sourceCard().getByRole('button',{name:'特殊登場',exact:true}),allowed=!['special-no-skill','special-wrong-level'].includes(fixture)
     assert.equal(await special.count(),allowed?1:0);canAttack=false
     if(allowed){await special.click();const modal=page.locator('.special-play-modal:visible');await modal.waitFor();await fits(modal);const confirm=modal.getByRole('button',{name:'確認特殊登場',exact:true}),cost=modal.locator('.special-play-candidate');assert.equal(await cost.count(),1);assert.equal(await confirm.isEnabled(),false);await cost.click();if(scenario==='special-deselect'){await cost.click();assert.equal(await confirm.isEnabled(),false);await cost.click()}await shot('special-cost');if(scenario==='special-cancel'){await modal.getByRole('button',{name:'取消',exact:true}).click();assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace)}else{await confirm.click();await sourceCard().locator('.hp-card-stack').waitFor();await settle(page);await skipReplacement();row.special=await state(page);assert.equal(row.special.own.battle.find(c=>c.id==='final-source').hp,4);assert.equal(row.special.own.deck,row.before.own.deck-4);assert.equal(row.special.own.hand,0);assert.equal(row.special.own.trash,row.before.own.trash+2);assert.equal(row.special.own.breakLevel,0);canAttack=true}}
     else{assert.deepEqual(await state(page),row.before);assert.deepEqual(await trace(page),row.beforeTrace);await shot('blocked-special')}
    }
    if(canAttack&&await attack()){
     if(base==='BS12-109'&&fixture==='few-opponent-support'){
      assert.equal(await page.locator('.effect-panel:not(.is-complete):visible').count(),0);assert.equal(await page.locator('.hand-discard-modal:visible').count(),0)
      const after=await state(page);assert.deepEqual(after.own.handIds,row.before.own.handIds);assert.equal(after.own.battle.find(card=>card.id==='final-source').hp,2);assert.equal(after.own.deck,row.before.own.deck);row.thenConditionNotMet=true
     }else if(base==='BS12-109'){
      const effect=page.locator('.effect-panel:not(.is-complete):visible');await effect.waitFor();await fits(effect)
      const companion=records.find(record=>record.cardNumber==='BS12-094');assert.ok(companion)
      const target=effect.locator('.effect-candidates-target button').filter({hasText:companion.name});assert.equal(await target.count(),1);await target.click()
      await effect.getByRole('button',{name:'確認發動',exact:true}).click();await settle(page)
      const placement=page.locator('.hand-discard-modal:visible');await placement.waitFor();await fits(placement)
      const heading=await placement.locator('h2').innerText();assert.ok(heading.includes(source.name));assert.ok(heading.includes(companion.name));assert.match(heading,/HP 最上方/)
      assert.match(await placement.locator('.faint-target-hint').innerText(),/面朝上/)
      const placedCard=records.find(record=>record.cardNumber==='BS12-095');assert.ok(placedCard)
      const handOption=placement.locator('.modal-card-options > button').filter({hasText:placedCard.name});assert.equal(await handOption.count(),1);await handOption.click()
      await placement.getByRole('button',{name:'確認放置 (1)',exact:true}).click();await settle(page)
      const after=await state(page),targetBefore=row.ordinary.own.battle.find(card=>card.id==='final-companion')
      assert.ok(targetBefore);assert.equal(after.own.battle.find(card=>card.id==='final-companion').hp,targetBefore.hp+1)
      assert.ok(!after.own.handIds.includes('final-hand-special'));assert.equal(after.own.deck,row.before.own.deck);assert.ok(after.own.support.every(support=>support.rested))
      const topHp=page.locator('[data-card-instance-id="final-companion"] .hp-card-stack .hp-card').last(),visibleHp=topHp.locator('img[alt="'+placedCard.name+'"]')
      await visibleHp.waitFor();assert.equal(await visibleHp.getAttribute('src'),placedCard.imageUrl)
      const placementTrace=(await trace(page)).slice(row.beforeTrace.length).find(entry=>entry.commandKind==='resolve-place-hand-hp')
      assert.ok(placementTrace);assert.match(placementTrace.summary,/面朝上.*最上方/);assert.match(placementTrace.steps.join('\n'),/正面朝上.*最上方/)
      row.thenPlaced={targetInstanceId:'final-companion',handCardInstanceId:'final-hand-special',targetHpBefore:targetBefore.hp,targetHpAfter:after.own.battle.find(card=>card.id==='final-companion').hp,placement:placementTrace}
     }
     else if(base==='BS12-111'){await page.waitForFunction(()=>document.querySelector('.effect-panel:not(.is-complete)')||[...document.querySelectorAll('button')].some(b=>b.textContent?.trim()==='結束主要階段'&&!b.disabled));const panel=page.locator('.effect-panel:not(.is-complete):visible');if(await panel.count()){await panel.getByRole('button',{name:'確認發動',exact:true}).click();await settle(page)}assert.equal(await page.getByRole('button',{name:'結束主要階段',exact:true}).isEnabled(),true);const hp=fixture==='attack-first-player'?5:6;await page.waitForFunction(hp=>document.querySelector('[data-card-instance-id="final-extra"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 '+hp+' 張'),hp);const after=await state(page);assert.equal(after.own.battle.find(c=>c.id==='final-extra').hp,hp);assert.equal(after.own.deck,row.before.own.deck-(hp-5))}
     else if(base==='BS12-112'){
      const then=page.locator('.optional-cost-attack-inline:visible,.optional-cost-attack-modal:visible');await then.waitFor();await fits(then);const before=await state(page)
      if(scenario==='then-skip'){await then.getByRole('button',{name:'略過',exact:true}).click();await settle(page);const after=await state(page),resources=s=>({...s,battle:s.battle.map(({text,...card})=>{assert.equal(typeof text,'string');return card})});assert.deepEqual(resources(after.own),resources(before.own));assert.deepEqual(resources(after.enemy),resources(before.enemy))}else{
       await then.getByRole('button',{name:'支付',exact:true}).click();assert.equal(await then.locator('.modal-card-options > button').count(),0);row.hiddenHpPreviewPrevented=true
       if(scenario==='return-target'){await then.getByRole('button',{name:'返回',exact:true}).click();const afterReturn=await state(page),resources=s=>({...s,battle:s.battle.map(({text,...card})=>{assert.equal(typeof text,'string');return card})});assert.deepEqual(resources(afterReturn.own),resources(before.own));assert.deepEqual(resources(afterReturn.enemy),resources(before.enemy));await then.getByRole('button',{name:'支付',exact:true}).click();assert.equal(await then.locator('.modal-card-options > button').count(),0)}
       await shot('before-source-cost');await then.getByRole('button',{name:'確認',exact:true}).click();await settle(page)
       const recovery=page.locator('.effect-panel:not(.is-complete):visible');let options=recovery.locator('.effect-candidates-target button');await options.first().waitFor();const paid=await state(page);assert.ok(!paid.own.battle.some(c=>c.id==='final-source'));assert.equal(paid.own.trash,before.own.trash+5);assert.deepEqual(paid.own.handIds,before.own.handIds);assert.equal(await recovery.getByRole('button',{name:'返回',exact:true}).count(),0);assert.equal(await recovery.getByRole('button',{name:'取消技能',exact:true}).count(),0);row.paidBeforeRecovery=paid
       const fresh=fixture==='new-hp-target';assert.equal(await options.count(),fresh?4:6);assert.equal(await options.filter({hasText:'Muscle Cookie'}).count(),0);assert.equal(await options.filter({hasText:'Mold Dough Cookie'}).count(),0);assert.equal(await options.filter({hasText:'Red Velvet Cookie'}).count(),0)
       const zero=['then-zero','single-source','invalid-lv','invalid-non-arena','invalid-non-cookie'].includes(fixture),one=fixture==='then-one',indices=zero?[]:fresh?[1,2]:one?[0]:[0,1],ids=zero?[]:fresh?['final-own-deck-0','final-own-deck-1']:one?['final-recovery-red']:['final-recovery-red','final-recovery-black'];for(const i of indices)await options.nth(i).click()
       if(scenario==='minimize-then'){await recovery.getByRole('button',{name:/收合|縮小/}).click();await page.locator('.effect-panel-dock').click();await recovery.waitFor()}await shot('source-cost-target');await recovery.getByRole('button',{name:'確認發動',exact:true}).click();await settle(page);await skipReplacement();row.recovered=await state(page);assert.deepEqual(row.recovered.own.handIds,ids);assert.ok(!row.recovered.own.battle.some(c=>c.id==='final-source'));assert.equal(row.recovered.own.trash,before.own.trash+5-ids.length);assert.equal(row.recovered.own.breakLevel,before.own.breakLevel)
      }
     }
    }
   }
  }
  row.after=await state(page);row.trace=await trace(page);assert.deepEqual(row.trace.slice(0,row.beforeTrace.length),row.beforeTrace);row.mountedOriginalArt=await page.evaluate(async urls=>{const imgs=[...document.images].filter(i=>urls.includes(i.src));await Promise.all(imgs.map(i=>i.decode()));return imgs.map(i=>({src:i.src,alt:i.alt,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight}))},art.map(a=>a.record.imageUrl));assert.ok(row.mountedOriginalArt.length&&row.mountedOriginalArt.every(i=>records.some(r=>r.imageUrl===i.src)&&i.naturalWidth>0&&i.naturalHeight>0));await shot('result');assert.deepEqual(row.errors,[]);assert.deepEqual(row.networkFailures,[]);row.status='PASS';console.log('PASS '+number+' '+scenario+' '+viewport.width+'x'+viewport.height)
 }catch(error){row.error=error.stack??String(error);row.dom=(await page.locator('body').innerText()).slice(0,22000);await shot('FAIL');results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2)+'\n');throw error}finally{await page.close()}
 results.push(row);writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2)+'\n')
}}finally{await browser.close()}
console.log(number+' Browser '+results.length+'/'+results.length)
