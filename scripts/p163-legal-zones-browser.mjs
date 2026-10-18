import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const output=process.env.BRAVERSE_P163_OUTPUT??'output/ai-cookierift/p163-legal-browser'
await mkdir(output,{recursive:true})
const port=4222,rows=[]
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const scenario of ['positive','green-arena','non-arena','negative','wrong-color','zero','cancel']){
  const page=await browser.newPage({viewport}),errors=[],row={scenario,viewport,status:'FAIL'}
  page.on('pageerror',e=>errors.push(e.message))
  try{
   await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:P-163:${scenario==='cancel'?'positive':scenario}&contract-card=P-163`)
   await page.locator('.bottom-field .combat-card-wrap').first().waitFor()
   await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
   assert.equal(await page.locator('.bottom-field .combat-card-wrap').count(),2)
   assert.equal(await page.locator('.top-field .combat-card-wrap').count(),1)
   const card=id=>page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id^="player-one-${id}-"]`).first()
   const source=card('P-163'),target=card(scenario==='green-arena'?'BS7-062':scenario==='non-arena'?'ST1-001':'BS12-016')
   const attackBefore=Number((await target.locator('.badge-atk').innerText()).match(/\d+/)[0])
   const art=source.locator('img').first()
   await art.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('Original art failed'))}))
   assert.match(await art.getAttribute('src'),/cookierunbraverse.com\/data\/en_storage\//)
   const skill=source.locator('.skill-action')
   if(['negative','wrong-color'].includes(scenario))assert.ok(await skill.count()===0||!await skill.isEnabled())
   else{
    await skill.click()
    await page.locator('.effect-candidates-payment button').click()
    await page.locator('.effect-panel-primary-action').click()
    const candidates=page.locator('.effect-candidates-target button')
    if(scenario==='non-arena'){
     assert.equal(await candidates.count(),0)
     if(await page.locator('.effect-panel-primary-action').isVisible())await page.locator('.effect-panel-primary-action').click()
    }else{
     assert.deepEqual(await candidates.locator('span').allTextContents(),[scenario==='green-arena'?'Plantain Cookie':'Strawberry Mochi Cookie'])
     if(scenario==='cancel')await page.locator('.skip-effect').click()
     else{if(scenario!=='zero')await candidates.first().click();await page.locator('.effect-panel-primary-action').click()}
    }
    await page.locator('.effect-panel').waitFor({state:'hidden'})
   }
   const boosted=['positive','green-arena'].includes(scenario)
   assert.equal(Number((await target.locator('.badge-atk').innerText()).match(/\d+/)[0]),attackBefore+(boosted?1:0))
   assert.equal(await target.locator('.card-face').first().evaluate(e=>e.classList.contains('is-rested')),!boosted)
   const paid=!['cancel','wrong-color'].includes(scenario)
   assert.equal(await page.locator('.bottom-field .support-card-wrap .card-face').first().evaluate(e=>e.classList.contains('is-rested')),paid)
   row.trace=await page.evaluate(()=>window.__braverseContractTrace??[])
   if(!['negative','wrong-color','cancel'].includes(scenario))assert.ok(row.trace.some(e=>['activate-skill','begin-activate-skill'].includes(e.commandKind)))
   assert.deepEqual(errors,[]);row.status='PASS'
  }catch(error){row.error=String(error);throw error}
  finally{rows.push(row);await page.screenshot({path:`${output}/${scenario}-${viewport.width}-${row.status}.png`,fullPage:true});await page.close()}
 }
}finally{await browser?.close();server.kill();await writeFile(`${output}/results.json`,JSON.stringify({scope:'Local original-card legal two-Cookie Browser fixtures; not online acceptance.',rows},null,2))}
console.log(`PASS ${rows.length} P-163 legal-zone Browser cases`)
