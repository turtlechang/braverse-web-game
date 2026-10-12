import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const output='output/ai-cookierift/community-browser',port=4212
await mkdir(output,{recursive:true})
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port)],{stdio:'ignore'})
const accepted=['cookierift-921','cookierift-927','cookierift-67','cookierift-83','cookierift-568','cookierift-506']
const expected=['blue','green','yellow','red','purple','black'].map(color=>`bs12-${color}-arena`).concat(accepted)
let browser
const rows=[]
try{
  for(let i=0;i<50;i++){try{if((await fetch(`http://127.0.0.1:${port}`)).ok)break}catch{/* starting */}await new Promise(resolve=>setTimeout(resolve,100))}
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
  for(const viewport of [{width:1366,height:768},{width:1164,height:777}])for(const choice of accepted){
    const page=await browser.newPage({viewport}),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    try{
      await page.goto(`http://127.0.0.1:${port}`)
      const select=page.getByLabel(/^AI 牌組/).first()
      await select.waitFor()
      assert.deepEqual(await select.locator('option').evaluateAll(options=>options.map(option=>option.value)),expected)
      await select.selectOption(choice)
      await page.getByRole('button',{name:'AI 對戰',exact:true}).click()
      for(let i=0;i<100;i++){
        if(await page.locator('.bottom-field .combat-card-wrap').count()&&await page.locator('.top-field .combat-card-wrap').count())break
        const modal=page.locator('.opening-setup-modal').first()
        if(await modal.count()&&await modal.isVisible()){
          const heading=await modal.locator('h2').innerText()
          if(heading.includes('選擇牌組'))await modal.getByRole('button',{name:/BS12 藍色/}).first().click()
          else if(heading.includes('猜拳'))await modal.getByRole('button',{name:'石頭',exact:true}).click()
          else if(heading.includes('先攻或後攻'))await modal.getByRole('button',{name:'選擇先攻',exact:true}).click()
          else if(heading.includes('第一次調度'))await modal.getByRole('button',{name:'保留手牌',exact:true}).click()
          else if(heading.includes('起始餅乾'))await modal.locator('.modal-card-options > button:not(:disabled)').first().click()
        }
        await page.waitForTimeout(100)
      }
      assert.ok(await page.locator('.bottom-field .combat-card-wrap').count()>0)
      assert.ok(await page.locator('.top-field .combat-card-wrap').count()>0)
      const opponent=page.locator('.top-field .combat-card-wrap img').first()
      await opponent.evaluate(img=>img.complete&&img.naturalWidth>0?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Opponent card art failed'))}))
      assert.deepEqual(errors,[])
      await page.screenshot({path:`${output}/${choice}-${viewport.width}.png`,fullPage:true})
      rows.push({choice,viewport,opponentImage:await opponent.getAttribute('src'),menuChoices:expected,openingComplete:true,errors})
      console.log(`${choice} ${viewport.width} PASS`)
    }finally{await page.close()}
  }
}finally{
  await writeFile(`${output}/results.json`,JSON.stringify(rows,null,2))
  await browser?.close();server.kill()
}
