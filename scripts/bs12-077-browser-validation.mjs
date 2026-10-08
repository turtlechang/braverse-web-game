import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const module = await import(pathToFileURL(require.resolve('playwright', { paths: process.env.PLAYWRIGHT_NODE_MODULES ? [process.env.PLAYWRIGHT_NODE_MODULES] : [root] })).href)
const chromium = module.chromium ?? module.default?.chromium
const out = resolve(root, process.env.BS12_BROWSER_OUTPUT ?? 'test-results/bs12-077-browser')
mkdirSync(out, { recursive: true })
const candidate = JSON.parse(readFileSync(resolve(root,'data/candidates/official-festival-arena-bs12.en.json'),'utf8')).cards
const references = readdirSync(resolve(root,'data/cards')).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(readFileSync(resolve(root,'data/cards',f),'utf8')).cards??[])
const cards = [...candidate,...references].filter(card=>existsSync(resolve(root,'test-results/bs12-official-art/'+card.cardNumber+'.webp')))
const state = page => page.evaluate(() => {
  const side = name => {
    const field = document.querySelector(`.${name}-field`)
    const count = selector => Number(field?.querySelector(selector)?.textContent ?? NaN)
    return { deck: count('.deck-zone .resource-summary > strong'), trash: count('.discard-zone.resource-summary > strong'),
      hand: field?.querySelectorAll('.hand-card').length ?? 0,
      battle: [...(field?.querySelectorAll('.combat-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        hp: Number(node.querySelector('.hp-card-stack')?.getAttribute('aria-label')?.match(/HP 卡 (\d+) 張/)?.[1] ?? NaN),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false,
        equipped: node.querySelector('.badge-equip')?.getAttribute('aria-label') ?? null })),
      support: [...(field?.querySelectorAll('.support-card-wrap') ?? [])].map(node => ({ id: node.getAttribute('data-card-instance-id'),
        rested: node.querySelector('.card-face')?.classList.contains('is-rested') ?? false })),
    }
  }
  return { bottom: side('bottom'), top: side('top') }
})
const trace = page => page.evaluate(() => (window.__braverseContractTrace ?? []).map(e => ({ commandKind: e.commandKind, summary: e.summary, steps: e.steps })))
const settle = page => page.waitForFunction(() => !document.querySelector('.match-animation-layer[data-playing="true"]') &&
  ![...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '略過目前演出'), null, { timeout: 20000 })
// Rotated support cards overlap on tablet. Click a visibly exposed part of the intended button.
const clickExposed = async (page, locator) => {
  const point = await locator.evaluate(button => {
    const r = button.getBoundingClientRect()
    for (const fx of [0.15, 0.3, 0.5, 0.7, 0.85]) for (const fy of [0.3, 0.5, 0.7]) {
      const x = r.x + r.width * fx
      const y = r.y + r.height * fy
      const hit = document.elementFromPoint(x, y)
      if (hit && (hit === button || button.contains(hit))) return { x, y }
    }
    return null
  })
  assert.ok(point, 'Payment button has no visible exposed point')
  await page.mouse.click(point.x, point.y)
}
const ordinaryCases = ['deploy', 'attack', 'mixed-energy', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main', 'cancel-payment', 'cancel-target', 'payment-deselect', 'equip-blocked']
const cases = [...ordinaryCases, 'equipped', 'no-equipment', 'wrong-host', 'other-attacker', 'second-attack', 'defender', 'defender-no-equipment', 'defender-rested-blocker', 'blocker-back', 'blocker-skip', 'defender-trap', 'flip']
const browser = await chromium.launch({ headless: true, executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync) })
const results = []
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1164, height: 777 }]) for (const scenario of cases.filter(v => !process.env.BS12_BROWSER_CASES || process.env.BS12_BROWSER_CASES.split(',').includes(v))) {
    const ordinary = ordinaryCases.includes(scenario)
    const isolatedEquipment = ['equipped', 'wrong-host', 'other-attacker', 'second-attack', 'defender', 'defender-trap', 'flip'].includes(scenario)
    const result = { number: 'BS12-077', scenario, viewport, isolatedEquipment, errors: [], networkFailures: [], printedSourceAttested: !isolatedEquipment, status: 'FAIL' }
    const page = await browser.newPage({ viewport })
    page.on('pageerror', e => result.errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()) })
    page.on('requestfailed', r => result.networkFailures.push({ url: r.url(), resourceType: r.resourceType(), error: r.failure()?.errorText }))
    const shot = label => page.screenshot({ path: resolve(out, `${scenario}-${viewport.width}-${label}.png`) })
    try {
      for (const card of cards) await page.route(card.imageUrl, r => r.fulfill({ contentType: 'image/webp', body: readFileSync(resolve(root, `test-results/bs12-official-art/${card.cardNumber}.webp`)) }))
      const routeCase = ['cancel-payment', 'cancel-target', 'payment-deselect'].includes(scenario) ? 'attack' : ['blocker-back', 'blocker-skip'].includes(scenario) ? 'defender-no-equipment' : scenario === 'second-attack' ? 'other-attacker' : scenario
      result.testState = process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'equipped' ? 'card:'+'BS12-077' : process.env.BS12_BROWSER_ROUTE === 'generic' && scenario === 'no-equipment' ? 'card-negative:'+'BS12-077' : 'bs12-077:'+routeCase
      await page.goto((process.env.BRAVERSE_BASE_URL ?? 'http://127.0.0.1:5173')+'/?test-state='+result.testState+'&contract-card=BS12-001,BS12-002,BS12-003,BS12-009,BS12-010,BS12-011,BS12-012,BS12-013,BS12-016,BS12-019,BS12-021,BS12-027,BS12-028,BS12-029,BS12-030,BS12-031,BS12-040,BS12-046,BS12-058,BS12-059,BS12-060,BS12-061,BS12-064,BS12-065,BS12-069,BS12-070,BS12-071,BS12-072,BS12-073,BS12-074,BS12-075,BS12-076,BS12-077,BS12-078,BS12-083,BS12-084,BS12-086,BS4-090,BS4-014,BS6-008,BS6-017,BS7-061,ST4-001'+'')
      await page.locator('.game-shell').waitFor()
      await page.getByRole('combobox', { name: '動畫速度', exact: true }).selectOption({ label: '減少動畫' })
      await settle(page)
      result.before = await state(page)
      result.beforeTrace = await trace(page)
      const source = page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-077-source"]')
      if (scenario === 'deploy') {
        const hand = page.locator('.bottom-field .hand-card-wrap[data-card-instance-id="bs12-077-source"]')
        await hand.locator('.card-face').click()
        await hand.getByRole('button', { name: '登場', exact: true }).click()
        await source.waitFor()
        await settle(page)
        const entered = await state(page)
        assert.equal(entered.bottom.battle[0].hp, 3)
        assert.equal(entered.bottom.deck, 9)
        assert.equal(entered.bottom.hand, 0)
        assert.deepEqual(entered.bottom.support, result.before.bottom.support)
        assert.deepEqual(entered.top, result.before.top)
        assert.deepEqual((await trace(page)).map(e => e.commandKind), ['deploy-cookie'])
      }
      if (ordinary) {
        await source.locator('img').first().evaluate(i => i.decode())
        assert.equal(await source.locator('img').first().getAttribute('src'), cards.find(card => card.cardNumber === 'BS12-077').imageUrl)
        assert.equal((await state(page)).bottom.battle.find(c => c.id === 'bs12-077-source').hp, 3)
        if (['deploy', 'attack', 'mixed-energy', 'cancel-payment', 'cancel-target', 'payment-deselect', 'equip-blocked'].includes(scenario)) {
          assert.match(await source.locator('.skill-unavailable-reason').innerText(), /HP.*裁定尚未確認/)
          assert.equal(await source.locator('.skill-action').isEnabled(), false)
        }
      }
      if (scenario === 'equip-blocked' || scenario === 'deploy') {
        assert.equal((await trace(page)).some(e => e.commandKind.includes('activate-skill')), false)
      } else if (['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'].includes(scenario)) {
        assert.equal(await source.locator('.card-face.is-attackable').count(), 0)
        assert.deepEqual(await state(page), result.before)
        assert.deepEqual(await trace(page), result.beforeTrace)
      } else if (routeCase.startsWith('defender')) {
        if (['defender-no-equipment', 'blocker-back', 'blocker-skip'].includes(scenario)) {
          const chooser = page.locator('.attack-response-modal')
          await chooser.getByRole('button', { name: 'Peperoncino Cookie Peperoncino Cookie', exact: true }).click()
          const modal = page.locator('.blocker-response-modal')
          assert.match(await modal.innerText(), /代價：橫置「Peperoncino Cookie」/)
          assert.deepEqual(await state(page), result.before)
          if (scenario === 'blocker-back') {
            await modal.getByRole('button', { name: '返回', exact: true }).click()
            assert.deepEqual(await state(page), result.before)
            assert.deepEqual(await trace(page), result.beforeTrace)
            await chooser.getByRole('button', { name: 'Peperoncino Cookie Peperoncino Cookie', exact: true }).click()
          }
          await shot('before-confirm')
          await modal.getByRole('button', { name: scenario === 'blocker-skip' ? '不使用' : '使用 Blocker', exact: true }).click()
          await page.waitForFunction(skip => document.querySelector(`.bottom-field .combat-card-wrap[data-card-instance-id="${skip ? 'bs12-077-opponent' : 'bs12-077-blocker'}"] .hp-card-stack`)?.getAttribute('aria-label')?.includes('HP 卡 3 張'), scenario === 'blocker-skip')
          await settle(page)
          const after = await state(page)
          assert.equal(after.bottom.battle[0].hp, scenario === 'blocker-skip' ? 3 : 4)
          assert.equal(after.bottom.battle[1].hp, scenario === 'blocker-skip' ? 4 : 3)
          assert.equal(after.bottom.battle[1].rested, scenario !== 'blocker-skip')
          assert.equal((await trace(page)).some(e => e.commandKind === 'play-blocker'), scenario !== 'blocker-skip')
        } else if (scenario === 'defender-trap') {
          const trap = page.locator('.trap-response-modal')
          await trap.waitFor()
          assert.equal(await page.locator('.blocker-candidates').count(), 0)
          assert.match(await trap.innerText(), /Misdelivered Fan Letter/)
          await shot('trap-available')
          await trap.getByRole('button', { name: 'Misdelivered Fan Letter Misdelivered Fan Letter', exact: true }).click()
          await trap.getByRole('button', { name: 'Candy Diver Cookie Candy Diver Cookie', exact: true }).click()
          await trap.getByRole('button', { name: '下一步', exact: true }).click()
          await trap.getByRole('button', { name: 'Rockstar Cookie Rockstar Cookie ⚔ 攻擊中', exact: true }).click()
          await trap.getByRole('button', { name: '確認發動', exact: true }).click()
          await page.getByRole('alertdialog').getByRole('button', { name: '確認發動', exact: true }).click()
          await page.getByRole('alertdialog').getByRole('button', { name: '略過', exact: true }).click()
          await page.waitForFunction(() => !document.querySelector('[role="alertdialog"]'))
          await settle(page)
          const after = await state(page)
          assert.equal(after.bottom.battle[0].hp, 4)
          assert.equal(after.bottom.battle[1].rested, false)
          assert.equal(after.bottom.hand, 0)
          assert.equal(after.bottom.trash, 1)
          assert.equal(after.bottom.support[0].rested, true)
          assert.equal((await trace(page)).filter(e => e.commandKind === 'play-trap').length, 1)
          assert.equal((await trace(page)).some(e => e.commandKind === 'play-blocker'), false)
        } else {
          await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-077-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 3 張'))
          await settle(page)
          const after = await state(page)
          assert.equal(after.bottom.battle[0].hp, 3)
          assert.equal(after.bottom.battle[1].hp, 4)
          assert.equal(after.bottom.battle[1].rested, scenario === 'defender-rested-blocker')
          assert.equal((await trace(page)).some(e => e.commandKind === 'play-blocker'), false)
        }
      } else {
        const actorId = ordinary ? 'bs12-077-source' : scenario === 'other-attacker' ? 'bs12-077-other-attacker' : 'bs12-077-host'
        const actor = page.locator(`.bottom-field .combat-card-wrap[data-card-instance-id="${actorId}"]`)
        await actor.locator('.card-face.is-attackable').click()
        const target = page.locator('.top-field .combat-card-wrap[data-card-instance-id="bs12-077-opponent"] .card-face:not(.hp-card)')
        const pay = index => page.locator(`.bottom-field .support-card-wrap[data-card-instance-id="bs12-077-payment-${index}"] .card-face`)
        await pay(0).click()
        if (scenario === 'cancel-payment') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
        else {
          const count = ordinary || ['wrong-host', 'other-attacker'].includes(scenario) ? 2 : 1
          if (count === 2) {
            assert.equal(await target.getAttribute('aria-label') === '選擇攻擊目標：Langue de Chat Cookie', false)
            await pay(1).click()
          }
          if (scenario === 'payment-deselect') {
            await clickExposed(page, pay(0))
            assert.equal(await target.getAttribute('aria-label') === '選擇攻擊目標：Langue de Chat Cookie', false)
            await pay(0).click()
          }
          assert.match(await target.getAttribute('aria-label'), /^選擇攻擊目標：/)
          await shot('payment')
          if (scenario === 'cancel-target') await page.getByRole('button', { name: '取消攻擊', exact: true }).click()
          else {
            await target.click()
            await page.waitForFunction(() => !document.querySelector('.effect-panel:not(.is-complete)'))
            await settle(page)
            await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(e => e.commandKind === 'declare-attack'))
            if (['no-equipment', 'wrong-host', 'other-attacker'].includes(scenario)) {
              await page.waitForFunction(() => (window.__braverseContractTrace ?? []).some(e => e.commandKind === 'play-blocker'))
              await page.waitForFunction(expected => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-077-blocker"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${expected} 張`), scenario === 'no-equipment' ? 3 : 2)
              assert.equal((await state(page)).top.battle[0].hp, 4)
              assert.equal((await state(page)).top.battle[1].rested, true)
            } else {
              await page.waitForFunction(flip => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-077-opponent"] .hp-card-stack')?.getAttribute('aria-label')?.includes(`HP 卡 ${flip ? 4 : 3} 張`) && (!flip || document.querySelectorAll('.top-field .hand-card').length === 0 && document.querySelector('.top-field .deck-zone .resource-summary > strong')?.textContent === '11'), scenario === 'flip')
              assert.equal((await trace(page)).some(e => e.commandKind === 'play-blocker'), false)
              assert.equal((await state(page)).top.battle[1].rested, false)
              if (scenario === 'flip') {
                assert.equal((await state(page)).top.hand, 0)
                assert.equal((await state(page)).top.deck, 11)
                assert.equal((await state(page)).top.trash, 2)
                assert.equal((await trace(page)).some(e => e.commandKind === 'resolve-flip'), true)
              }
            }
            const after = await state(page)
            assert.equal(after.bottom.battle.find(c => c.id === actorId).rested, true)
            if (ordinary) {
              assert.equal(after.top.battle[0].hp, 3)
              assert.equal(after.top.trash, 1)
              assert.deepEqual(after.top.battle[1], result.before.top.battle[1])
              assert.equal(after.bottom.deck, 9)
              assert.equal(after.bottom.trash, 0)
              assert.deepEqual(after.bottom.support, result.before.bottom.support.map(s => ({ ...s, rested: true })))
            }
            await page.getByRole('button', { name: '對戰紀錄', exact: true }).click()
            await page.getByRole('button', { name: new RegExp(`${ordinary ? 'Spotlight Fan' : scenario === 'other-attacker' || scenario === 'wrong-host' ? 'Gnome Band' : 'Rockstar Cookie'} 攻擊 玩家`) }).click()
            result.publicText = await page.locator('body').innerText()
            if (['equipped', 'flip', 'second-attack'].includes(scenario)) assert.match(result.publicText, /Spotlight Fan.*本次戰鬥.*Blocker/)
            await shot('public-trace')
            await page.getByRole('button', { name: '關閉對戰紀錄', exact: true }).click()
            if (scenario === 'second-attack') {
              await page.waitForFunction(() => document.querySelector('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-077-other-attacker"] .card-face.is-attackable'))
              await page.locator('.bottom-field .combat-card-wrap[data-card-instance-id="bs12-077-other-attacker"] .card-face.is-attackable').click()
              await pay(1).click()
              await pay(2).click()
              await target.click()
              await page.waitForFunction(() => document.querySelector('.top-field .combat-card-wrap[data-card-instance-id="bs12-077-blocker"] .hp-card-stack')?.getAttribute('aria-label')?.includes('HP 卡 2 張'))
              await settle(page)
              const second = await state(page)
              assert.equal(second.top.battle[0].hp, 3)
              assert.equal(second.top.battle[1].rested, true)
              assert.equal(second.bottom.battle.every(c => c.rested), true)
              assert.equal(second.bottom.support.every(s => s.rested), true)
              assert.equal((await trace(page)).filter(e => e.commandKind === 'declare-attack').length, 2)
              assert.equal((await trace(page)).filter(e => e.commandKind === 'play-blocker').length, 1)
            }
          }
        }
        if (['cancel-payment', 'cancel-target'].includes(scenario)) {
          assert.deepEqual(await state(page), result.before)
          assert.deepEqual(await trace(page), result.beforeTrace)
        }
      }
      result.after = await state(page)
      result.trace = await trace(page)
      await shot('result')
      assert.deepEqual(result.errors, [])
      // Transient HP faces can be removed before their original-art request
      // finishes. Keep every cancellation, and require all mounted original
      // images (including payment/target/log faces) to decode successfully.
      result.mountedOriginalArt = await page.evaluate(async urls => {
        const mounted = [...document.images].filter(img => urls.includes(img.src))
        return Promise.all(mounted.map(async img => {
          await img.decode()
          if (!img.naturalWidth) throw new Error(`Original card art failed: ${img.src}`)
          return { url: img.src, alt: img.alt, naturalWidth: img.naturalWidth }
        }))
      }, cards.map(card => card.imageUrl))
      result.cancelledOriginalImageRequests = result.networkFailures.filter(entry =>
        entry.resourceType === 'image' && entry.error === 'net::ERR_ABORTED' && cards.some(card => card.imageUrl === entry.url))
      result.networkFailures = result.networkFailures.filter(entry => !result.cancelledOriginalImageRequests.includes(entry))
      assert.deepEqual(result.networkFailures, [])
      result.status = 'PASS'
    } catch (e) {
      result.error = String(e.stack ?? e)
      result.after = await state(page).catch(() => null)
      result.trace = await trace(page).catch(() => [])
      result.dom = await page.locator('body').innerText().catch(() => '')
      results.push(result)
      writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
      throw e
    } finally { await page.close() }
    results.push(result)
    writeFileSync(resolve(out, process.env.BS12_BROWSER_CASES ? 'subset-results.json' : 'results.json'), JSON.stringify(results, null, 2))
    console.log(`PASS BS12-077 ${scenario} ${viewport.width}x${viewport.height} isolated=${isolatedEquipment}`)
  }
  console.log(`BS12-077 Browser ${results.length}/${results.length}; isolated=${results.filter(r => r.isolatedEquipment).length}`)
} finally { await browser.close() }
