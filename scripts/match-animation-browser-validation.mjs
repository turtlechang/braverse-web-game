import { chromium } from 'playwright'
import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

const [width, height] = (process.env.BRAVERSE_ANIMATION_VIEWPORT ?? '1920x1080').split('x').map(Number)
const speed = process.env.BRAVERSE_ANIMATION_SPEED ?? 'standard'
assert.ok(width > 0 && height > 0)
assert.ok(['standard', 'fast', 'reduced'].includes(speed))
const port = Number(process.env.BRAVERSE_ANIMATION_PORT ?? 4291)
const baseUrl = `http://127.0.0.1:${port}`
const outputPrefix = `test-results/animation-${width}x${height}-${speed}`
await mkdir('test-results', { recursive: true })
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
for (let attempt = 0; attempt < 60; attempt++) {
  try { if ((await fetch(baseUrl)).ok) break } catch { /* Preview startup. */ }
  await new Promise(resolve => setTimeout(resolve, 100))
}
const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
const pageErrors = []
const blockedImages = []

const browser=await chromium.launch({executablePath,headless:true});
const context=await browser.newContext({viewport:{width,height},recordVideo:{dir:`${outputPrefix}-video`,size:{width,height}}});
const deckSeries = (process.env.BRAVERSE_MATCH_DECK_SERIES ?? 'ST1').toUpperCase()
const deckEntriesBySeries = {
  ST1: [
    ['ST1-002',4],['ST1-003',4],['ST1-005',4],['ST1-006',4],['ST1-007',4],
    ['ST1-008',4],['ST1-009',4],['ST1-010',4],['ST1-011',4],['ST1-012',4],
    ['ST1-001',4],['ST1-004',4],['ST1-013',4],['ST1-015',4],['ST1-016',2],['ST1-020',2],
  ],
  BS11: [
    ['BS11-001',4],['BS11-002',4],['BS11-003',4],['BS11-004',4],['BS11-005',4],
    ['BS11-006',4],['BS11-007',4],['BS11-008',4],['BS11-014',4],['BS11-015',4],
    ['BS11-016',4],['BS11-017',4],['BS11-018',4],['BS11-019',4],['BS11-020',4],
  ],
}
const selectedDeckEntries = deckEntriesBySeries[deckSeries]
if (!selectedDeckEntries) throw new Error(`Unsupported match deck series: ${deckSeries}`)
if (selectedDeckEntries.reduce((sum, [, count]) => sum + count, 0) !== 60) {
  throw new Error(`${deckSeries} match deck must contain exactly 60 cards`)
}
if (deckSeries === 'BS11' && selectedDeckEntries.some(([cardNumber]) => !cardNumber.startsWith('BS11-'))) {
  throw new Error('BS11 match deck contains cards from another series')
}
await context.addInitScript(({series, entries})=>{localStorage.setItem('braverse-custom-decks',JSON.stringify({version:1,decks:[{id:`animation-${series.toLowerCase()}`,name:`動畫驗收 ${series}`,entries,createdAt:'2026-09-14T00:00:00Z',updatedAt:'2026-09-14T00:00:00Z'}]}));},{series:deckSeries,entries:selectedDeckEntries.map(([cardNumber,count])=>({cardNumber,count}))});
await context.addInitScript(value => { localStorage.setItem('braverse.animation-speed', value) }, speed)
const page=await context.newPage()
page.on('pageerror',error=>pageErrors.push(error.message))
page.on('requestfailed',request=>{ if(request.resourceType()==='image') blockedImages.push(request.url()) })
try {
await page.goto(baseUrl);await page.getByRole('button',{name:'AI 對戰',exact:true}).click();await page.waitForTimeout(1000);
assert.equal(await page.locator('.table-area [data-hand-slot]').count(), 0, 'Hands must stay off the table before order confirmation');
for(let i=0;i<100;i++){
 const modal=page.locator('.opening-setup-modal'); if(!await modal.count()) {
  if(await page.locator('.match-animation-layer[data-playing="true"]').count()) {await page.waitForTimeout(100);continue;}
  break;
 }
 const rock=modal.getByRole('button',{name:'石頭',exact:true});
 const chooseFirst=modal.getByRole('button',{name:'選擇先攻',exact:true});
 const keepHand=modal.getByRole('button',{name:'保留手牌',exact:true});
 const startingCookie=modal.locator('.setup-hand button:not(:disabled)').first();
 if(await rock.count()) await rock.click();
 else if(await chooseFirst.count()) await chooseFirst.click();
 else if(await keepHand.count()) await keepHand.click();
 else if(await startingCookie.count()) await startingCookie.click();
 await page.waitForTimeout(350);
 }
assert.equal(await page.locator('.opening-setup-modal').count(),0,'Formal opening setup must complete before the match loop')
await page.waitForTimeout(6000);


let finished=false; let placed=false;
for(let i=0;i<500;i++){
 const result=page.locator('.result-modal');
 if(await result.count()){finished=true; console.log('FINISHED',await result.innerText());break;}
 if(await page.getByRole('button',{name:'略過目前演出',exact:true}).count()){await page.waitForTimeout(220);continue;}
 if(!placed && !(await page.locator('.modal-backdrop:visible').count()) && (await page.locator('.phase-rail').innerText()).includes('支援階段')){
  const card=page.locator('.bottom-hand .hand-card').first();
  if(await card.count()) {await card.click({timeout:2000});
   const support=page.getByRole('button',{name:'支援',exact:true});
   if(await support.count() && await support.isEnabled()){await support.click();placed=true;await page.screenshot({path:`${outputPrefix}-support.png`});console.log('SUPPORT PLACED');continue;}
  }
 }
 const skip=page.getByRole('button').filter({hasText:/^(略過(?!目前演出)|不發動|不使用|跳過|略過整個登場效果|略過效果|不發動 FLIP)/}).filter({visible:true}).first();
 if(await skip.count() && await skip.isEnabled()){console.log('CHOICE',await skip.innerText());await skip.click();await page.waitForTimeout(250);continue;}
 const phase=page.locator('.phase-rail .next-phase-button').filter({visible:true});
 if(await phase.count() && await phase.isEnabled()){console.log('PHASE',await phase.innerText());await phase.click();await page.waitForTimeout(250);continue;}
 const options=page.locator('.modal-card-options > button:not(:disabled)').filter({visible:true});
 if(await options.count()){console.log('SELECT',await options.first().innerText());await options.first().click();await page.waitForTimeout(200);}
 const confirm=page.getByRole('button').filter({hasText:/^(確認|完成|繼續|結算)/}).filter({visible:true}).first();
 if(await confirm.count() && await confirm.isEnabled()){console.log('CONFIRM',await confirm.innerText());await confirm.click();await page.waitForTimeout(200);continue;}
 if(i%20===0)console.log('WAIT',i,(await page.locator('body').innerText()).slice(-1000));
 await page.waitForTimeout(300);
}
assert.equal(finished,true,'Formal AI match must reach its result through visible controls')
assert.deepEqual(pageErrors,[])
await page.screenshot({path:`${outputPrefix}-end.png`});
const report = {viewport:{width,height},speed,deckSeries,formalMatchFinished:finished,supportPlaced:placed,pageErrors,blockedImageRequests:blockedImages.length,artworkVerified:blockedImages.length===0}
await writeFile(`${outputPrefix}-report.json`,JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
} catch(error) {
  console.error((await page.locator('body').innerText()).slice(-2500))
  await page.screenshot({path:`${outputPrefix}-failure.png`})
  throw error
} finally {
  await context.close()
  await browser.close()
  preview.kill()
}
