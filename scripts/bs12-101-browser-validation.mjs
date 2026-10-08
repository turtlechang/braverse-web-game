import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url))), require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-101-browser')
mkdirSync(out, { recursive: true })
const records = ['data/cards/official-festival-arena-bs12.en.json', ...readdirSync(resolve(root, 'data/cards')).filter(f => f.endsWith('.json')).map(f => `data/cards/${f}`)]
  .flatMap(path => JSON.parse(readFileSync(resolve(root, path), 'utf8')).cards ?? [])
const art=records.map(record=>({record,path:['bs12-official-art','bs11-official-art'].map(dir=>resolve(root,'test-results/'+dir+'/'+record.cardNumber+'.webp')).find(existsSync)})).filter(entry=>entry.path)
for(const entry of art)assert.ok(entry.record.imageUrl&&existsSync(entry.path))
const cards=art.map(entry=>entry.record)
const state = page => page.evaluate(() => {
  const side = id => {
    const field = document.querySelector(`.battle-row[data-animation-player="${id}"]`)
    return { deck: Number(field?.querySelector('.deck-zone .resource-summary > strong')?.textContent), trash: Number(field?.querySelector('.discard-zone.resource-summary > strong')?.textContent),
      hand: Number(field?.querySelector('[aria-label^="手牌 "]')?.getAttribute('aria-label')?.match(/手牌 (\d+)/)?.[1] ?? 0),
      breakCount: Number(field?.querySelector('.break-zone .zone-heading b')?.textContent?.match(/\d+/)?.[0] ?? 0),
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), hp: Number(n.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(n => ({ id: n.getAttribute('data-card-instance-id'), rested: n.querySelector('.card-face')?.classList.contains('is-rested') ?? false })) }
  }
  return { own: side('player-one'), enemy: side('player-two') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') && ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
const clickExposedCard = async locator => {
  const point = await locator.evaluate(el => { const b = el.getBoundingClientRect(); for (const x of [0.15, 0.3, 0.5, 0.7, 0.85]) for (const y of [0.3, 0.5, 0.7]) if (el.contains(document.elementFromPoint(b.left + b.width * x, b.top + b.height * y))) return { x: b.width * x, y: b.height * y }; return null })
  assert.ok(point, 'Card has no exposed clickable area'); await locator.click({ position: point })
}

const blocked = ['no-energy','wrong-energy','rested-energy','source-rested','opponent-turn','outside-main','first-turn']
const invalid = ['arena-item','arena-stage','non-arena','split','no-hand','wrong-zones']
const cases = ['details','deploy','full-battle','positive','red-hand','green-hand','yellow-hand','blue-hand','purple-hand','high-level','same-name','flip-cost','two-costs','mixed-hand','large-hand','spare-energy',
  ...invalid,...blocked,'cancel-payment','cancel-target','payment-deselect','other-target','skip-then','discard-deselect','discard-back','discard-other','discard-max','then-minimize','selected-minimize','draw-zero','draw-minimize',
  'target-faints','flip-before-then','flip-skip','source-faints','short-deck','empty-deck','refresh-defeat','one-deck']
const route = scenario => scenario === 'details' ? 'deploy' : ['cancel-payment','cancel-target','payment-deselect','other-target','skip-then','draw-zero','draw-minimize','then-minimize'].includes(scenario) ? 'positive'
  : ['discard-deselect','discard-back','selected-minimize'].includes(scenario) ? 'mixed-hand' : ['discard-other','discard-max'].includes(scenario) ? 'two-costs' : scenario === 'flip-skip' ? 'flip-before-then' : scenario
const expectedCostNames = scenario => {
  const map = {'red-hand':'Peach Cookie','green-hand':'Basil Pesto Cookie','yellow-hand':'GingerBrave','blue-hand':'Sonic Water Cookie','purple-hand':'Currant Cream Cookie','high-level':'Muscle Cookie','same-name':'Chess Choco Cookie','flip-cost':'Cherry Blossom Cookie'}
  if (['two-costs','discard-other','discard-max'].includes(scenario)) return ['Peach Cookie','Blueberry Cake Hound']
  if (scenario === 'large-hand') return ['Blueberry Cake Hound','Subtle Jasmine Cake Hound']
  return [map[scenario] ?? 'Blueberry Cake Hound']
}
const browser = await chromium.launch({headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)})
const results = []
try {
  for (const viewport of [{width:1280,height:720},{width:1164,height:777}]) for (const scenario of cases.filter(value => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(value))) {
    const page = await browser.newPage({viewport}), row = {number:'BS12-101',scenario,viewport,printedSourceAttested:true,status:'FAIL',errors:[],networkFailures:[]}
    page.setDefaultTimeout(12000)
    page.on('pageerror',error => row.errors.push(error.message)); page.on('console',message => {if (message.type() === 'error') row.errors.push(message.text())}); page.on('requestfailed',request => row.networkFailures.push({url:request.url(),error:request.failure()?.errorText}))
    const shot = label => page.screenshot({path:resolve(out,`${scenario}-${viewport.width}-${label}.png`)})
    const own = page.locator('.battle-row[data-animation-player="player-one"]'), enemy = page.locator('.battle-row[data-animation-player="player-two"]')
    const source = own.locator('.combat-card-wrap[data-card-instance-id="bs12-101-source"]'), handSource = own.locator('.hand-card-wrap').filter({has:page.locator('img[alt="Chess Choco Cookie"]')})
    const fits = async modal => {const box = await modal.boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x+box.width <= viewport.width+1 && box.y+box.height <= viewport.height+1,'Decision panel outside viewport')}
    const refresh = async () => {
      const modal = page.locator('.decision-modal').filter({hasText:'牌庫 Refresh'}); await modal.waitFor(); await fits(modal); await shot('refresh')
      const name = scenario === 'short-deck' ? 'Blueberry Cake Hound' : 'Peach Cookie'
      await modal.locator('.decision-card-options > button').filter({has:page.locator(`img[alt="${name}"]`)}).click(); await settle(page)
    }
    try {
      for (const image of art) await page.route(image.record.imageUrl, request => request.fulfill({contentType:'image/webp',body:readFileSync(image.path)}))
      row.testState=process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='positive'?'card:BS12-101':process.env.BS12_BROWSER_ROUTE==='generic'&&scenario==='non-arena'?'card-negative:BS12-101':'bs12-101:'+route(scenario)
      await page.goto((process.env.BRAVERSE_BASE_URL??'http://127.0.0.1:5173')+'/?test-state='+row.testState+'&contract-card='+cards.map(c=>c.cardNumber).join(','))
      await page.locator('.game-shell').waitFor(); await page.getByRole('combobox',{name:'動畫速度',exact:true}).selectOption({label:'減少動畫'}); await settle(page)
      row.before = await state(page); row.beforeTrace=await trace(page)
      const sourceImage = ['details','deploy','full-battle'].includes(scenario) ? handSource.locator('img').first() : source.locator('img').first()
      await sourceImage.evaluate(img=>img.decode())
      assert.deepEqual(await sourceImage.evaluate(img => ({width:img.naturalWidth,height:img.naturalHeight,src:img.currentSrc})),{width:746,height:1038,src:records.find(card=>card.cardNumber==='BS12-101').imageUrl}); row.originalArtVisible = true
      if (scenario === 'details') {
        await clickExposedCard(handSource.locator('button.card-face')); await handSource.getByRole('button',{name:'詳情',exact:true}).click(); const detail = page.locator('.card-detail-modal'); await detail.waitFor(); await fits(detail)
        assert.match(await detail.innerText(),/BS12-101/); assert.match(await detail.innerText(),/Winning Strategy.*1/s)
        assert.match(await detail.innerText(),/discard 1.*Arena.*Cookie.*hand.*Draw up to 1/)
        assert.deepEqual(await detail.locator('.card-detail-rules > .card-rule-section > strong').allTextContents(),['攻擊']); await shot('details'); await detail.locator('.close-modal').click()
        assert.deepEqual(await state(page),row.before); assert.deepEqual(await trace(page),row.beforeTrace)
      } else if (['deploy','full-battle'].includes(scenario)) {
        await clickExposedCard(handSource.locator('button.card-face'))
        if (scenario === 'full-battle') {assert.equal(await handSource.getByRole('button',{name:'登場',exact:true}).count(),0); assert.deepEqual(await state(page),row.before); assert.deepEqual(await trace(page),row.beforeTrace); await shot('blocked')}
        else {await handSource.getByRole('button',{name:'登場',exact:true}).click(); await source.waitFor(); await settle(page); const after = await state(page); assert.deepEqual(after.own.battle.map(card=>card.hp),[2,2]); assert.equal(after.own.deck,10); assert.equal(after.own.hand,1); assert.equal(after.own.trash,0)}
      } else if (blocked.includes(scenario)) {
        assert.equal(await source.locator('.card-face.is-attackable').count(),0); assert.deepEqual(await state(page),row.before); assert.deepEqual(await trace(page),row.beforeTrace); await shot('blocked')
      } else {
        assert.equal(await source.locator('.skill-action').count(),0)
        await source.locator('.card-face.is-attackable').click()
        if (scenario === 'cancel-payment') {await page.getByRole('button',{name:'取消攻擊',exact:true}).click(); assert.deepEqual(await state(page),row.before); assert.deepEqual(await trace(page),row.beforeTrace)}
        else {
          const payment = own.locator('.support-card-wrap[data-card-instance-id="bs12-101-payment"] .card-face'), otherTarget = scenario === 'other-target'
          const target = enemy.locator(`.combat-card-wrap[data-card-instance-id="bs12-101-opponent${otherTarget?'-other':''}"] .card-face:not(.hp-card)`)
          await clickExposedCard(payment); assert.match(await target.getAttribute('aria-label'),/^選擇攻擊目標：/); assert.deepEqual(await trace(page),row.beforeTrace)
          if (scenario === 'payment-deselect') {await clickExposedCard(payment); assert.doesNotMatch(await target.getAttribute('aria-label') ?? '',/^選擇攻擊目標：/); await clickExposedCard(payment)}
          await shot('payment')
          if (scenario === 'cancel-target') {await page.getByRole('button',{name:'取消攻擊',exact:true}).click(); assert.deepEqual(await state(page),row.before); assert.deepEqual(await trace(page),row.beforeTrace)}
          else {
            await target.click()
            if (['flip-before-then','flip-skip','source-faints'].includes(scenario)) {
              const flip = page.locator('.flip-response-modal'); await flip.waitFor(); await fits(flip); await shot('intervening-flip')
              if (scenario === 'flip-skip') await flip.getByRole('button',{name:'不發動',exact:true}).click()
              else {
                if (scenario === 'flip-before-then') await flip.locator('.modal-card-options > button').filter({has:page.locator('img[alt="Sweet Jams Guitar"]')}).click()
                await flip.getByRole('group',{name:'FLIP 效果目標',exact:true}).getByRole('button').filter({has:page.locator(`img[alt="${scenario==='source-faints'?'Chess Choco Cookie':'Kohlrabi Cookie'}"]`)}).click()
                await flip.getByRole('button',{name:'發動 FLIP',exact:true}).click(); await settle(page)
              }
            }
            const then = page.locator('.optional-cost-attack-inline:visible'); await then.waitFor({timeout:20000}); await settle(page); await fits(then)
            row.ordinary = await state(page)
            assert.deepEqual(row.ordinary.enemy.battle.map(card=>card.hp),['target-faints','flip-skip'].includes(scenario)?[2]:scenario==='source-faints'?[1,4]:otherTarget?[4,1]:scenario==='flip-before-then'?[1,2]:[3,2])
            if(scenario==='flip-skip'){assert.equal(row.ordinary.enemy.trash,1);assert.equal(await page.locator('.top-field .break-zone img[alt="Kohlrabi Cookie"]').count(),1)}
            assert.equal(row.ordinary.own.hand,row.before.own.hand); assert.equal(row.ordinary.own.deck,row.before.own.deck); assert.equal(row.ordinary.own.trash,row.before.own.trash+(scenario==='source-faints'?1:0))
            assert.deepEqual(row.ordinary.own.battle.map(card=>card.hp),scenario==='source-faints'?[2]:row.before.own.battle.map(card=>card.hp))
            assert.match(await page.locator('.effect-panel').innerText(),/Chess Choco Cookie/); assert.doesNotMatch(await page.locator('.effect-panel').innerText(),/Unknown/); assert.match(await then.innerText(),/棄置 1 張【Arena】餅乾手牌/)
            const panelImage = page.locator('.effect-source-card img').first(); await panelImage.evaluate(img=>img.decode()); assert.equal(await panelImage.getAttribute('src'),records.find(card=>card.cardNumber==='BS12-101').imageUrl)
            await shot('then')
            if (scenario==='then-minimize') {await page.locator('.effect-panel').getByRole('button',{name:/收合|縮小/}).click(); await page.locator('.effect-panel-dock').click(); await then.waitFor(); assert.deepEqual(await state(page),row.ordinary)}
            const skip = invalid.includes(scenario)||scenario==='skip-then'
            if (skip) {assert.equal(await then.getByRole('button',{name:'支付',exact:true}).isEnabled(),!invalid.includes(scenario)); await then.getByRole('button',{name:'略過',exact:true}).click()}
            else {
              await then.getByRole('button',{name:'支付',exact:true}).click()
              const choices = then.locator('.modal-card-options > button'), confirm = then.getByRole('button',{name:'確認',exact:true})
              row.costCandidates = await choices.locator('span').allTextContents()
              const imageNames = await choices.locator('img').evaluateAll(images=>images.map(image=>image.alt)); assert.deepEqual(imageNames,expectedCostNames(scenario))
              assert.equal(await confirm.isEnabled(),false)
              const index = scenario==='discard-other'?1:0; await choices.nth(index).click(); assert.equal(await confirm.isEnabled(),true)
              if (scenario==='discard-deselect') {await choices.nth(index).click(); assert.equal(await confirm.isEnabled(),false); await choices.nth(index).click()}
              if (scenario==='discard-max') {await choices.nth(1).click(); assert.match(await choices.nth(0).getAttribute('class'),/is-selected/); assert.doesNotMatch(await choices.nth(1).getAttribute('class') ?? '',/is-selected/)}
              if (scenario==='discard-back') {await then.getByRole('button',{name:'返回',exact:true}).click(); assert.deepEqual(await state(page),row.ordinary); await then.getByRole('button',{name:'支付',exact:true}).click(); assert.equal(await confirm.isEnabled(),false); await choices.nth(index).click()}
              if (scenario==='selected-minimize') {await page.locator('.effect-panel').getByRole('button',{name:/收合|縮小/}).click(); await page.locator('.effect-panel-dock').click(); await then.waitFor(); assert.equal(await confirm.isEnabled(),true); assert.match(await choices.nth(index).getAttribute('class'),/is-selected/)}
              assert.deepEqual(await state(page),row.ordinary); await shot('cost-selected'); await confirm.click(); await settle(page)
              row.paid = await state(page)
              assert.equal(row.paid.own.hand,row.ordinary.own.hand-1); assert.equal(row.paid.own.trash,row.ordinary.own.trash+1); assert.equal(row.paid.own.deck,row.ordinary.own.deck); assert.deepEqual(row.paid.enemy,row.ordinary.enemy)
              {
                const drawPanel = page.locator('.draw-up-to-modal'); await drawPanel.waitFor(); await fits(drawPanel); assert.match(await drawPanel.innerText(),/Chess Choco Cookie/); assert.match(await drawPanel.innerText(),/最多.*1.*張/)
                const zero = ['draw-zero','one-deck'].includes(scenario)
                await drawPanel.getByRole('button',{name:zero?'不抽':/^抽 1 張/}).click()
                if (scenario==='draw-minimize') {await drawPanel.getByRole('button',{name:/縮小/}).click(); await page.locator('.decision-reveal-dock').click(); await drawPanel.waitFor()}
                await shot('draw-choice'); await drawPanel.getByRole('button',{name:zero?'略過抽牌':'抽取 1 張牌',exact:true}).click(); await settle(page)
                if (['empty-deck','short-deck','refresh-defeat'].includes(scenario)) await refresh()
                if (scenario==='refresh-defeat') {await page.locator('.result-modal').waitFor(); assert.match(await page.locator('.result-modal').innerText(),/敗北|落敗|勝利/)}
              }
            }
            await settle(page)
            if (scenario==='source-faints') {const replacement = page.getByRole('button',{name:'不補餅乾',exact:true}); await replacement.waitFor(); await replacement.click(); await settle(page)}
            row.after = await state(page)
            if (skip) assert.deepEqual(row.after,row.ordinary)
            else if (!['empty-deck','short-deck','refresh-defeat'].includes(scenario)) {
              const zero = ['draw-zero','one-deck'].includes(scenario)
              assert.equal(row.after.own.hand,row.ordinary.own.hand-1+(zero?0:1)); assert.equal(row.after.own.deck,row.ordinary.own.deck-(zero?0:1)); assert.equal(row.after.own.trash,row.ordinary.own.trash+1); assert.deepEqual(row.after.enemy,row.ordinary.enemy); assert.deepEqual(row.after.own.battle,row.ordinary.own.battle)
            } else if (scenario==='empty-deck') {assert.equal(row.after.own.hand,1); assert.equal(row.after.own.breakCount,1); assert.equal(row.after.own.deck,2); assert.equal(row.after.own.trash,0)}
            else if (scenario==='short-deck') {assert.equal(row.after.own.hand,1); assert.equal(row.after.own.breakCount,1); assert.equal(row.after.own.deck,3); assert.equal(row.after.own.trash,0)}
            else {assert.equal(row.after.own.hand,0); assert.equal(row.after.own.breakCount,4)}
            assert.deepEqual(row.after.own.support,row.ordinary.own.support)
            row.trace = await trace(page)
            const commands = row.trace.map(entry=>entry.commandKind), ordered = ['declare-attack','resolve-attack-effect','resolve-optional-cost-attack',...(!skip?['resolve-draw-up-to']:[])]
            let last = -1; for (const kind of ordered) {const index = commands.indexOf(kind,last+1); assert.ok(index>last,`Missing ordered ${kind}`); last=index}
            const paidTrace = row.trace.find(entry=>entry.commandKind==='resolve-optional-cost-attack'); assert.match(paidTrace.steps.join(' '),skip?/未支付代價/:/棄置手牌/)
            if (scenario === 'refresh-defeat') {
              await page.getByRole('button',{name:'查看對戰紀錄',exact:true}).click(); const log=page.getByTestId('battle-log-review-modal'); await log.waitFor(); await page.getByTestId('battle-log-review-expand-all').click(); row.visiblePublicLog=await log.innerText(); assert.match(row.visiblePublicLog,/Chess Choco Cookie/); assert.match(row.visiblePublicLog,/棄置手牌/); await shot('public-log'); await log.getByRole('button',{name:'關閉對戰紀錄回顧',exact:true}).click()
            } else if (['positive','draw-zero','no-hand','source-faints','target-faints','empty-deck','discard-other'].includes(scenario)) {await page.getByRole('button',{name:'對戰紀錄',exact:true}).click(); const log=page.getByRole('complementary',{name:'對戰紀錄側欄'}); await log.locator('.battle-log-entry').filter({hasText:'Chess Choco Cookie'}).first().click(); row.visiblePublicLog=await log.innerText(); assert.match(row.visiblePublicLog,/Chess Choco Cookie/); assert.match(row.visiblePublicLog,skip?/未支付代價/:/棄置手牌/); await shot('public-log'); await page.getByRole('button',{name:'關閉對戰紀錄',exact:true}).click()}
          }
        }
      }
      row.after ??= await state(page); row.trace ??= await trace(page)
      await shot('result'); assert.deepEqual(row.errors,[])
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
      assert.deepEqual(row.networkFailures, []); row.status='PASS'; console.log(`PASS BS12-101 ${scenario} ${viewport.width}x${viewport.height}`)
    } catch (error) {row.error=error.stack??String(error); row.dom=(await page.locator('body').innerText()).slice(0,18000); await shot('FAIL'); results.push(row); writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2)); throw error}
    finally {await page.close()}
    results.push(row); writeFileSync(resolve(out,process.env.BS12_BROWSER_CASES?'subset-results.json':'results.json'),JSON.stringify(results,null,2))
  }
} finally {await browser.close()}
console.log(`BS12-101 Browser ${results.filter(row=>row.status==='PASS').length}/${results.length}`)
