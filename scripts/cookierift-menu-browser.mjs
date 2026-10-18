import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output='output/ai-cookierift/community-browser-20261017-current-menu-897-283-1140',port=4240
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'})
const accepted=['cookierift-921','cookierift-927','cookierift-801','cookierift-973','cookierift-67','cookierift-83','cookierift-793','cookierift-568','cookierift-506','cookierift-1035','cookierift-16','cookierift-731','cookierift-1164','cookierift-1239','cookierift-1151','cookierift-1259','cookierift-1207','cookierift-1268','cookierift-897','cookierift-283','cookierift-1140','cookierift-1248','cookierift-1127','cookierift-1001','cookierift-1174','cookierift-1290','cookierift-1291','cookierift-1295']
const bs12Choices=['blue','green','yellow','red','purple','black'].map(color=>`bs12-${color}-arena`).concat('bs12-red-korean-starter')
const choices=[...bs12Choices,...accepted]
const expected=choices
const communitySnapshots=await Promise.all(['20261017','20261016-silent','20261016','20261015','20261014','20261013','20261010'].map(async date=>JSON.parse(await readFile(`data/decks/cookierift-community-${date}.json`,'utf8'))))
const communitySources=communitySnapshots.flatMap(snapshot=>snapshot.decks)
const expectedRecipe=async choice=>{
  if(choice.startsWith('bs12-')){
    const recipe=JSON.parse(await readFile(`data/decks/${choice}.json`,'utf8'))
    const toCounts=entries=>Object.fromEntries(entries.map(({cardNumber,count})=>[cardNumber,count]))
    return {main:toCounts(recipe.entries),extra:toCounts(recipe.extraDeckEntries??[])}
  }
  const sourceId=Number(choice.slice('cookierift-'.length))
  const source=communitySources.find(deck=>deck.sourceId===sourceId)
  assert.ok(source,`Missing saved Cookierift source ${sourceId}`)
  const toCounts=text=>text.trim()?Object.fromEntries(text.trim().split(/\s+/).map(entry=>{
    const match=/^([A-Z0-9]+-\d{3}):(\d+)$/.exec(entry)
    assert.ok(match,`Invalid source recipe entry: ${entry}`)
    return [match[1],Number(match[2])]
  })): {}
  return {main:toCounts(source.main),extra:toCounts(source.extra)}
}
const expectedRecipes=new Map(await Promise.all(choices.map(async choice=>[choice,await expectedRecipe(choice)])))
const countCardInstances=value=>{
  const counts={},seen=new Set()
  const visit=node=>{
    if(Array.isArray(node)){for(const child of node)visit(child);return}
    if(!node||typeof node!=='object')return
    if(typeof node.id==='string'&&typeof node.instanceId==='string'&&!seen.has(node.instanceId)){
      seen.add(node.instanceId)
      counts[node.id]=(counts[node.id]??0)+1
    }
    for(const child of Object.values(node))visit(child)
  }
  visit(value)
  return Object.fromEntries(Object.entries(counts).sort(([left],[right])=>left.localeCompare(right)))
}
const sortedCounts=counts=>Object.fromEntries(Object.entries(counts).sort(([left],[right])=>left.localeCompare(right)))
let browser
const rows=[]
try{
  for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{/* starting */}await new Promise(resolve=>setTimeout(resolve,100))}
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const choice of choices){
    const page=await browser.newPage({viewport}),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(`http://127.0.0.1:${port}`)
      const select=page.getByLabel(/^AI 牌組/).first()
      await select.waitFor()
      assert.deepEqual(await select.locator('option').evaluateAll(options=>options.map(option=>option.value)),expected)
      await select.selectOption(choice)
      assert.equal(await select.inputValue(),choice)
      const selectedLabel=(await select.locator('option:checked').innerText()).trim()
      let setupDeckSummary=null
      await page.getByRole('button',{name:'AI 對戰',exact:true}).click()
      for(let i=0;i<100;i++){
        if(await page.locator('.bottom-field .combat-card-wrap').count()&&await page.locator('.top-field .combat-card-wrap').count())break
        const modal=page.locator('.opening-setup-modal').first()
        if(await modal.count()&&await modal.isVisible()){
          const heading=await modal.locator('h2').innerText()
          if(heading.includes('選擇牌組'))await modal.getByRole('button',{name:/BS12 藍色/}).first().click()
          else if(heading.includes('猜拳')){
            setupDeckSummary=await modal.locator('.setup-deck-summary summary').innerText()
            assert.ok(setupDeckSummary.includes(selectedLabel),`Opening setup did not carry selected AI deck ${choice}: ${setupDeckSummary}`)
            await modal.getByRole('button',{name:'石頭',exact:true}).click()
          }
          else if(heading.includes('先攻或後攻'))await modal.getByRole('button',{name:'選擇先攻',exact:true}).click()
          else if(heading.includes('第一次調度'))await modal.getByRole('button',{name:'保留手牌',exact:true}).click()
          else if(heading.includes('起始餅乾'))await modal.locator('.modal-card-options > button:not(:disabled)').first().click()
        }
        await page.waitForTimeout(100)
      }
      assert.ok(setupDeckSummary,`Opening setup was not observed for ${choice}`)
      assert.ok(await page.locator('.bottom-field .combat-card-wrap').count()>0)
      assert.ok(await page.locator('.top-field .combat-card-wrap').count()>0)
      const opponent=page.locator('.top-field .combat-card-wrap img').first()
      await opponent.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Opponent card art failed'))}))
      assert.deepEqual(errors,[])
      await page.screenshot({path:`${output}/${choice}-${viewport.width}.png`,fullPage:true})
      await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:`http://127.0.0.1:${port}`})
      await page.getByRole('button',{name:'對局工具',exact:true}).click()
      await page.getByRole('menuitem',{name:'暫停資訊'}).click()
      await page.getByRole('button',{name:'問題回報與執行資訊'}).click()
      await page.getByRole('button',{name:'複製問題包'}).click()
      await page.getByRole('button',{name:'已複製問題包'}).waitFor({timeout:5000})
      const bundle=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()))
      assert.equal(bundle.mode,'offline')
      assert.equal(bundle.decks.playerTwo,choice,`Issue bundle has the wrong AI deck for ${choice}`)
      const aiPlayer=bundle.initialState?.players?.['player-two']??bundle.capturedState?.players?.['player-two']
      assert.ok(aiPlayer,`Issue bundle has no AI player state for ${choice}`)
      const {extraDeck=[],...mainZones}=aiPlayer
      const actualMain=countCardInstances(mainZones)
      const actualExtra=countCardInstances(extraDeck)
      const expectedDeck=expectedRecipes.get(choice)
      assert.deepEqual(actualMain,sortedCounts(expectedDeck.main),`AI main deck contents differ from source for ${choice}`)
      assert.deepEqual(actualExtra,sortedCounts(expectedDeck.extra),`AI EXTRA deck contents differ from source for ${choice}`)
      rows.push({choice,viewport,opponentImage:await opponent.getAttribute('src'),menuChoices:expected,setupDeckSummary,issueBundleDeck:bundle.decks.playerTwo,actualMainCardCounts:actualMain,actualExtraCardCounts:actualExtra,openingComplete:true,errors})
      console.log(`${choice} ${viewport.width} PASS`)
    }finally{await page.close()}
  }
}finally{
  await writeFile(`${output}/results.json`,JSON.stringify(rows,null,2))
  await browser?.close();server.kill()
}
