import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'

const records = new Map()
for (const directory of ['data/candidates/st6-st10','data/cards']) {
  for (const name of await readdir(directory)) {
    if (!name.endsWith('.json')) continue
    const document = JSON.parse(await readFile(`${directory}/${name}`,'utf8'))
    for (const card of document.cards ?? []) {
      if (/^ST(?:6|7|8|9|10)-\d{3}$/.test(card.cardNumber)) {
        records.set(card.cardNumber,{...card,formal:directory==='data/cards'})
      }
    }
  }
}
if (records.size!==100) throw new Error(`Expected 100 base cards, found ${records.size}`)
await mkdir('output/st6-st10/images',{recursive:true})
const rows=[]
for (const card of [...records.values()].sort((a,b)=>a.cardNumber.localeCompare(b.cardNumber))) {
  const path=`output/st6-st10/images/${card.cardNumber}.webp`
  let bytes
  try { bytes=await readFile(path) } catch (error) {
    if (error.code!=='ENOENT') throw error
    const response=await fetch(card.imageUrl)
    if(!response.ok)throw new Error(`${card.cardNumber} art HTTP ${response.status}`)
    bytes=Buffer.from(await response.arrayBuffer())
    if(bytes.length<1000)throw new Error(`${card.cardNumber} invalid art response`)
    await writeFile(path,bytes,{flag:'wx'})
  }
  rows.push({cardNumber:card.cardNumber,name:card.name,formal:card.formal,
    imageUrl:card.imageUrl,path,sha256:createHash('sha256').update(bytes).digest('hex'),
    physicalReview:'pending',browser:'pending'})
}
await writeFile('output/st6-st10/image-manifest.json',JSON.stringify(rows,null,2)+'\n')
console.log(`Prepared ${rows.length} original card images; visual review and Browser acceptance remain pending.`)
