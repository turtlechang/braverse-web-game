import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output='output/ai-cookierift/browser-additions'
await mkdir(output,{recursive:true})
const port=4210, server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'})
const rows=[]
let browser
try{
  for(let i=0;i<40;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{/* starting */}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const viewport of [{width:1366,height:768},{width:1164,height:777}]){
    for(const number of ['P-163','ST7-005'])for(const scenario of ['positive','negative','low','zero',...(number==='P-163'?['cancel']:[])]){
      const page=await browser.newPage({viewport}),errors=[]
      page.on('pageerror',e=>errors.push(e.message))
      try{
        await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:${number}:${scenario==='cancel'?'positive':scenario}&contract-card=${number}`)
        await page.locator('.bottom-field').waitFor()
        await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
        const before=await page.locator('body').innerText()
        const card=id=>page.locator(`.bottom-field [data-card-instance-id^="player-one-${id}"]`).first()
        const image=number==='P-163'?card(number).locator('img').first():page.locator('.flip-response-modal img[alt="Caramel Choux Cookie"]').first()
        await image.waitFor()
        await image.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Original art failed'))}))
        assert.match(await image.getAttribute('src'),/cookierunbraverse.com\/data\/en_storage\//)
        if(number==='P-163'){
          const skill=card(number).locator('.skill-action')
          const target=card(scenario==='low'?'BS7-062':'BS12-016')
          const attackBefore=Number((await target.locator('.badge-atk').innerText()).match(/\d+/)[0])
          if(scenario==='negative')assert.ok(await skill.count()===0||!await skill.isEnabled())
          else{
            await skill.click()
            await page.locator('.effect-candidates-payment button').click()
            await page.locator('.effect-panel-primary-action').click()
            const candidates=page.locator('.effect-candidates-target button')
            assert.deepEqual(await candidates.locator('span').allTextContents(),scenario==='low'?['Plantain Cookie']:['Strawberry Mochi Cookie','Plantain Cookie'])
            if(scenario==='cancel')await page.locator('.skip-effect').click()
            else{
              if(scenario!=='zero')await candidates.filter({hasText:scenario==='low'?'Plantain Cookie':'Strawberry Mochi Cookie'}).click()
              await page.locator('.effect-panel-primary-action').click()
            }
            await page.locator('.effect-panel').waitFor({state:'hidden'})
          }
          const attackAfter=Number((await target.locator('.badge-atk').innerText()).match(/\d+/)[0])
          assert.equal(attackAfter,attackBefore+(['positive','low'].includes(scenario)?1:0))
          const paid=['positive','low','zero','negative'].includes(scenario)
          assert.equal(await card('ST1-020').locator('.card-face').evaluate(el=>el.classList.contains('is-rested')),paid)
          assert.equal(await card('BS12-016').count()>0?await card('BS12-016').locator('.card-face').first().evaluate(el=>el.classList.contains('is-rested')):await card('ST1-001').locator('.card-face').first().evaluate(el=>el.classList.contains('is-rested')),!['positive'].includes(scenario))
        }else{
          const flip=page.locator('.flip-response-modal')
          await flip.waitFor()
          const confirm=flip.getByRole('button',{name:/確認發動|發動效果|發動 FLIP/}).last()
          assert.equal(await confirm.isEnabled(),false)
          if(['negative','zero'].includes(scenario))await flip.getByRole('button',{name:'不發動',exact:true}).click()
          else{
            await flip.locator('.flip-card-page button').click();await confirm.click()
          }
          await flip.waitFor({state:'hidden'})
          await page.waitForTimeout(1500)
          if(['positive','low'].includes(scenario))assert.equal(await card('BS12-059').locator('.badge-hp').innerText(),'1/4')
          else assert.equal(await card('BS12-059').count(),0)
        }
        const after=await page.locator('body').innerText()
        const trace=await page.evaluate(()=>window.__braverseContractTrace??[])
        await page.screenshot({path:`${output}/${number}-${scenario}-${viewport.width}.png`,fullPage:true})
        rows.push({number,scenario,viewport,before,after,trace,errors})
        if(number==='P-163'&&!['negative','cancel'].includes(scenario))assert.ok(trace.some(e=>['activate-skill','begin-activate-skill'].includes(e.commandKind)))
        if(number==='ST7-005')assert.ok(trace.some(e=>e.commandKind==='resolve-flip'))
        console.log(JSON.stringify({number,scenario,width:viewport.width,trace}))
        assert.deepEqual(errors,[])
      }finally{await page.close()}
    }
  }
}finally{
  await writeFile(`${output}/results.json`,JSON.stringify(rows,null,2))
  await browser?.close();server.kill()
}
