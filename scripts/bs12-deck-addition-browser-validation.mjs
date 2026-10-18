import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
await mkdir('output/bs12-blue-check', {recursive:true})
const port = Number(process.env.BRAVERSE_TEST_PORT ?? 4192)
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'})
let browser
const results=[]
const visible = async l => await l.count() > 0 && await l.first().isVisible()
const enabled = async l => await visible(l) && await l.first().isEnabled()
try {
  await new Promise(r=>setTimeout(r,1000))
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  const numbers=(process.env.BRAVERSE_ADDITION_NUMBERS ?? 'ST8-018,ST9-016,ST10-002,ST10-007,ST10-008,ST10-013,ST10-019,P-175,P-176').split(',')
  const cases=numbers.flatMap(number=>(process.env.BRAVERSE_ADDITION_SCENARIOS?.split(',') ?? ['positive','negative',...(['ST8-018','ST10-019','ST10-008','P-176'].includes(number)?['low']:[]),...(['ST10-002','ST10-008','P-175','P-176'].includes(number)?['attack','attack-negative']:[])]).map(scenario=>({number,scenario})))
  for(const viewport of [{width:1366,height:768},{width:1164,height:777}]) for(const {number,scenario} of cases) {
    const page=await browser.newPage({viewport})
    const errors=[]; page.on('pageerror',e=>errors.push(e.message))
    const operations=[]
    try {
      await page.goto(`http://127.0.0.1:${port}/?test-state=deck-addition:${number}:${scenario}&contract-card=${number}`)
      await page.locator('.bottom-field').waitFor()
      await page.getByLabel('動畫速度',{exact:true}).selectOption('reduced')
      await page.waitForTimeout(1200)
      const before=await page.locator('body').innerText()
      const trap=page.locator('.trap-response-modal')
      if(['ST8-018','ST10-019'].includes(number)&&scenario!=='negative')await trap.waitFor()
      if(scenario.startsWith('attack')) {
        await page.locator(`.bottom-field [data-card-instance-id^="player-one-${number}"] .card-face`).first().click({force:true})
        for(let i=0;i<3;i++){const payment=page.locator('.bottom-field .support-card-wrap .card-face.is-targetable:not(.is-selected)').last();await payment.focus();await payment.press('Enter');await page.waitForTimeout(100)}
        await page.locator('.top-field .combat-card-wrap .card-face').first().click({force:true})
        operations.push('declare-attack');await page.waitForTimeout(800)
      }
      else if(await visible(trap)) await trap.locator('.modal-card-options button').first().click()
      else if(number==='ST10-007') {
        // Select the actual hand cost before the activation button.
      } else if(['ST9-016','ST10-013'].includes(number)) {
        const hand=page.locator('.bottom-hand .hand-card-wrap.is-actionable').first()
        if(await visible(hand)) {await hand.locator('.hand-card').click({force:true}); await page.locator('.hand-card-action').first().click({force:true})}
      } else {
        const action=page.locator(`.bottom-field [data-card-instance-id^="player-one-${number}"] .skill-action`).first()
        if(await enabled(action)) await action.click({force:true})
      }
      await page.waitForTimeout(150)
      for(let i=0;i<45;i++) {
        let acted=false
        const panel=page.locator('.effect-panel').first()
        if(await visible(trap)) {
          const next=trap.getByRole('button',{name:'下一步',exact:true})
          const payment=trap.locator('.trap-discard-options button:not(.is-selected):not(:disabled)').first()
          const target=trap.locator('.trap-target-options button:not(.is-selected):not(:disabled)').first()
          if(await enabled(next)){await next.click();operations.push('next');acted=true}
          else if(await enabled(payment)){await payment.click();operations.push('payment');acted=true}
          else if(scenario!=='zero' && await enabled(target) && await trap.locator('.trap-target-options button.is-selected').count() === 0){await target.click();operations.push('target');acted=true}
          else {
            const confirm=trap.getByRole('button',{name:/確認發動|發動陷阱/}).last()
            if(await enabled(confirm)){await confirm.click();operations.push('play-trap');acted=true}
          }
        } else if(await visible(page.locator('.optional-cost-attack-inline, .optional-cost-attack-modal'))) {
          const optional=page.locator('.optional-cost-attack-inline, .optional-cost-attack-modal').first()
          const pay=optional.locator('.modal-actions-decision button').filter({hasText:/支付/}).first()
          const target=optional.locator('.optional-cost-col .modal-card-options button:not(.is-selected):not(:disabled)').first()
          const confirm=optional.locator('.modal-actions-sticky button').last()
          if(await enabled(pay)){await pay.click();operations.push('start-then');acted=true}
          else if(await enabled(confirm)){await confirm.click();operations.push('pay-then');acted=true}
          else if(await enabled(target)){await target.click();operations.push('then-material');acted=true}
          else if(scenario==='attack-negative') {const skip=optional.getByRole('button',{name:/略過/}).first();if(await enabled(skip)){await skip.click();operations.push('skip-illegal-cost');acted=true}}
        } else if(await visible(page.locator('.draw-up-to-modal'))) {
          const draw=page.locator('.draw-up-to-modal');await draw.locator('.draw-up-to-option').last().click();await draw.locator('.draw-up-to-actions button').click();operations.push('draw-2');acted=true
        } else if(await visible(page.locator('.hand-discard-modal'))) {
          const discard=page.locator('.hand-discard-modal'); const confirm=discard.locator('.modal-actions button').last()
          if(await enabled(confirm))await confirm.click();else await discard.locator('.hand-discard-options button:not(.is-selected)').first().click();operations.push('discard-after-draw');acted=true
        } else if(await visible(panel)) {
          for(const selector of ['payment','discard-hand','trash-battle','target']) {
            if(scenario==='zero'&&selector==='target')continue
            const group=panel.locator(`.effect-candidates-${selector}`).first()
            if(!await visible(group))continue
            const text=await panel.innerText()
            const selected=await group.locator('button.is-selected').count()
            const matches=[...text.matchAll(/已選\s*(\d+)\s*[／/]\s*(\d+)/g)]
            let max=selector==='payment'? Number(text.match(/選擇\s*(\d+)\s*張支援/)?.[1]??1) :selector==='discard-hand'?3:1
            const typed=selector==='discard-hand'?text.match(/已選\s*(\d+)\s*[／/]\s*(\d+)\s*張手牌代價/):null
            if(typed)max=Number(typed[2])
            if(selector==='target'&&number==='ST10-008')max=2
            if(matches.length===1)max=Number(matches[0][2])
            const candidate=group.locator('button:not(.is-selected):not(:disabled)').first()
            if(selected<max&&await enabled(candidate)){await candidate.click();operations.push(selector);acted=true;break}
          }
          if(!acted){const primary=panel.locator('.effect-panel-primary-action').first();if(await enabled(primary)){operations.push(await primary.innerText());await primary.click();acted=true}}
        } else {
          const flip=page.locator('.flip-response-modal')
          if(await visible(flip)) {
            const candidate=flip.locator('.flip-card-page button:not(.is-selected):not(:disabled)').first()
            const confirm=flip.getByRole('button',{name:/確認發動|發動效果|發動 FLIP/}).last()
            if(await enabled(candidate)){await candidate.click();operations.push('flip-cost');acted=true}
            else if(await enabled(confirm)){await confirm.click();operations.push('flip');acted=true}
          }
        }
        if(!acted){await page.waitForTimeout(500); if(i < (scenario.startsWith('attack')?30:8)) continue; break}
        await page.waitForTimeout(150)
      }
      const after=await page.locator('body').innerText()
      const trace=await page.evaluate(()=>window.__braverseContractTrace??[])
      const hp = async (owner,card) => {
        const badge=page.locator(`[data-card-instance-id^="${owner}-${card}"] .badge-hp`).first()
        return await badge.count() ? await badge.innerText() : null
      }
      const publicHp={foe:await hp('player-two','BS12-059'),source:await hp('player-one',number)}
      await page.screenshot({path:`output/bs12-blue-check/${number}-${scenario}-${viewport.width}.png`,fullPage:true})
      const result={number,scenario,viewport,operations,before,after,trace,publicHp,errors}
      results.push(result)
      console.log(JSON.stringify({number,scenario,width:viewport.width,operations,trace}))
      assert.deepEqual(errors,[])
      if(scenario==='zero') {
        assert.ok(trace.length>0,'Optional zero path must still commit its real command')
        if(['ST9-016','P-175','ST10-013'].includes(number))assert.equal(publicHp.foe,'4/4')
      }
      if(scenario==='positive'&&number==='ST9-016')assert.equal(publicHp.foe,'1/4')
      if(scenario==='positive'&&['ST10-008','P-175'].includes(number))assert.equal(publicHp.foe,'3/4')
      if(scenario.startsWith('attack')&&number==='P-176')assert.equal(publicHp.source,scenario==='attack'?'5/4':'4/4')
      if(scenario==='attack'&&['ST10-002','ST10-008'].includes(number))assert.ok(trace.some(e=>e.commandKind==='resolve-optional-cost-attack'&&!e.summary?.includes('略過')), 'Attack Then must pay material')
      if(scenario==='attack'&&number==='ST10-002')assert.ok(trace.some(e=>e.commandKind==='resolve-opponent-hand-discard'), 'Moonlight must discard after draw')
      if(scenario==='positive') {
        assert.ok(trace.some(e=>['play-trap','begin-play-item','play-item','activate-skill','begin-activate-skill','resolve-flip'].includes(e.commandKind)),`${number} missing real command`)
        if(number==='ST10-007')assert.ok(trace.some(e=>e.commandKind==='resolve-flip'&&!e.summary.includes('不發動')), 'FLIP must actually activate')
        if(number==='P-175')assert.ok(trace.some(e=>e.summary?.includes('1 點傷害')), 'P-175 damage must settle after draw')
      }
    } catch(e) { console.log((await page.locator('body').innerText()).slice(-5000)); throw e }
    finally {await page.close()}
  }
} finally {
  await writeFile(`output/bs12-blue-check/additions-browser-results-${process.env.BRAVERSE_ADDITION_RUN ?? 'final'}.json`,JSON.stringify(results,null,2))
  await browser?.close(); server.kill()
}
