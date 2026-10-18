import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import currentSnapshot from '../../data/decks/cookierift-community-20261014.json'
import latestSnapshot from '../../data/decks/cookierift-community-20261015.json'
import newestSnapshot from '../../data/decks/cookierift-community-20261016.json'
import silentSnapshot from '../../data/decks/cookierift-community-20261016-silent.json'
import liveSnapshot from '../../data/decks/cookierift-community-20261017.json'
import previousSnapshot from '../../data/decks/cookierift-community-20261013.json'
import { COMMUNITY_DECK_PRESETS, type CommunityDeckChoice } from './community-deck-recipes'
import { createDeckForChoice, createExtraDeckForChoice } from './starter-deck'
import { validateCustomDeckDefinition } from './custom-deck'

describe('accepted Cookierift community recipes',()=>{
  it.each(Object.keys(COMMUNITY_DECK_PRESETS) as CommunityDeckChoice[])('%s uses the complete sourced list in the formal card pool',choice=>{
    const recipe=COMMUNITY_DECK_PRESETS[choice]
    expect(validateCustomDeckDefinition({entries:recipe.entries,extraDeckEntries:recipe.extraDeckEntries,format:'standard'}).errors).toEqual([])
    const main=createDeckForChoice(choice,'player-two'),extra=createExtraDeckForChoice(choice,'player-two')
    expect(main).toHaveLength(60)
    expect(extra.length).toBe(recipe.extraDeckEntries.reduce((n,e)=>n+e.count,0))
    expect(new Set([...main,...extra].map(card=>card.instanceId)).size).toBe(main.length+extra.length)
    for(const [cards,entries] of [[main,recipe.entries],[extra,recipe.extraDeckEntries]] as const){
      const counts=Object.fromEntries(entries.map(entry=>[entry.cardNumber,entry.count]))
      const actual:Record<string,number>={}
      for(const card of cards)actual[card.id]=(actual[card.id]??0)+1
      expect(actual).toEqual(counts)
    }
  })
  it('keeps recipes with missing cards outside the playable pool',()=>{
    expect(Object.keys(COMMUNITY_DECK_PRESETS)).toEqual([
      'cookierift-921','cookierift-927','cookierift-67','cookierift-83','cookierift-568','cookierift-506',
      'cookierift-1035','cookierift-793','cookierift-973','cookierift-16','cookierift-731','cookierift-801',
      'cookierift-1164','cookierift-1239','cookierift-1151','cookierift-1259','cookierift-1207','cookierift-1268','cookierift-897','cookierift-283','cookierift-1140','cookierift-1248','cookierift-1127','cookierift-1001','cookierift-1174','cookierift-1290','cookierift-1291','cookierift-1295',
    ])
    expect(new Set(Object.values(COMMUNITY_DECK_PRESETS).map(deck=>deck.color))).toEqual(
      new Set(['red','yellow','green','blue','purple','black','multi']),
    )
  })
  it.each([...liveSnapshot.decks,...silentSnapshot.decks,...newestSnapshot.decks.filter(source=>![1273,1251,1272].includes(source.sourceId)),...latestSnapshot.decks,...currentSnapshot.decks.filter(source=>source.sourceId!==51)])('preserves the exact playable Cookierift source record $sourceId',source=>{
    const recipe=COMMUNITY_DECK_PRESETS[`cookierift-${source.sourceId}` as CommunityDeckChoice]
    expect({name:recipe.name,color:recipe.color,author:recipe.author,sourceUrl:recipe.sourceUrl}).toEqual({
      name:source.name,
      color:source.color,
      author:source.author,
      sourceUrl:source.sourceUrl,
    })
    expect(recipe.entries.map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' ')).toBe(source.main)
    expect(recipe.extraDeckEntries.map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' ')).toBe(source.extra)
    const sourceHash=createHash('sha256').update([
      String(source.sourceId),source.color,source.name,source.author,source.sourceUrl,
      source.sourceUpdatedAt,source.main,source.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source.sourceHash).toBe(`sha256:${sourceHash}`)
  })
  it('keeps the Forky recipe quarantined until ST10-006 is in the formal card pool',()=>{
    const source=currentSnapshot.decks.find(deck=>deck.sourceId===51)
    expect(source?.main).toContain('ST10-006:2')
    expect(COMMUNITY_DECK_PRESETS).not.toHaveProperty('cookierift-51')
  })
  it('adds the latest low-overlap blue Sea Build source without changing its printed list',()=>{
    const source=newestSnapshot.decks.find(deck=>deck.sourceId===1248)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Sea Build',color:'blue',author:'DonutGaming',sourceUpdatedAt:'2026-10-16',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(`sha256:${sourceHash}`).toBe(source!.sourceHash)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(21)
    const recipeIds=(entries:typeof COMMUNITY_DECK_PRESETS['cookierift-1248']['entries'],extra:typeof COMMUNITY_DECK_PRESETS['cookierift-1248']['extraDeckEntries'])=>
      new Set([...entries,...extra].map(entry=>entry.cardNumber))
    const acceptedIds=recipeIds(COMMUNITY_DECK_PRESETS['cookierift-1248'].entries,COMMUNITY_DECK_PRESETS['cookierift-1248'].extraDeckEntries)
    expect(acceptedIds).toEqual(sourceIds)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1248').map(([choice,recipe])=>{
      const ids=recipeIds(recipe.entries,recipe.extraDeckEntries)
      const intersection=[...sourceIds].filter(cardId=>ids.has(cardId)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-1001',intersection:8,union:37})
    expect(overlaps[0]?.jaccard).toBeCloseTo(8/37)
  })
  it('adds a distinct purple Purple Arena recipe from Cookierift 1127',()=>{
    const source=newestSnapshot.decks.find(deck=>deck.sourceId===1127)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author}).toEqual({
      name:'Purple Arena',color:'purple',author:'Lyxn',
    })
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1127']
    const recipeIds=new Set([...recipe.entries,...recipe.extraDeckEntries].map(entry=>entry.cardNumber))
    expect(recipeIds).toEqual(sourceIds)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1127').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-568',intersection:9,union:33})
    expect(overlaps[0]?.jaccard).toBeCloseTo(9/33)
  })
  it('adds the legal green-blue Trial Deck from Cookierift 897 without substitutions',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===897)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Trial Deck',color:'multi',author:'Clarmander',sourceUpdatedAt:'2026-10-12',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(`sha256:${sourceHash}`).toBe(source!.sourceHash)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:3})
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(22)
    const recipeEntry=Object.entries(COMMUNITY_DECK_PRESETS).find(([choice])=>choice==='cookierift-897')
    expect(recipeEntry).toBeDefined()
    const recipe=recipeEntry?.[1]
    if(!recipe)return
    expect({name:recipe.name,color:recipe.color,author:recipe.author,sourceUrl:recipe.sourceUrl}).toEqual({
      name:source!.name,color:source!.color,author:source!.author,sourceUrl:source!.sourceUrl,
    })
    expect([...recipe.entries,...recipe.extraDeckEntries].map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' '))
      .toBe(`${source!.main} ${source!.extra}`)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-897').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-973',intersection:5,union:37})
    expect(overlaps[0]?.jaccard).toBeCloseTo(5/37)
  })
  it('adds the blue-purple Shadow Milk homebrew from Cookierift 283 without art substitutions',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===283)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Put me back together and take my heart',color:'multi',author:'LaDragaux',sourceUpdatedAt:'2026-09-22',
    })
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    expect(source!.main).toContain('BS9-079:4')
    expect(source!.main).toContain('BS11-071:4')
    expect(source!.extra).toContain('BS9-010:2')
    expect(source!.main).not.toMatch(/BS9-079@|BS11-071@/)
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(21)
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-283']
    expect([...recipe.entries,...recipe.extraDeckEntries].map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' '))
      .toBe(`${source!.main} ${source!.extra}`)
  })
  it('adds the low-overlap Sea-green community build from Cookierift 1140 without substitutions',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===1140)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Sea-green Deck! :D',color:'multi',author:'Lady_Pastel15',sourceUpdatedAt:'2026-10-11',
    })
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(31)
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1140']
    expect([...recipe.entries,...recipe.extraDeckEntries].map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' '))
      .toBe(`${source!.main} ${source!.extra}`)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1140').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-283',intersection:6,union:46})
    expect(overlaps[0]?.jaccard).toBeCloseTo(6/46)
  })
  it('adds the current Pure Shadow source as an exact playable blue recipe',()=>{
    const source=newestSnapshot.decks.find(deck=>deck.sourceId===1001)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Pure Shadow',color:'blue',author:'milk_man',sourceUpdatedAt:'2026-10-16',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(`sha256:${sourceHash}`).toBe(source!.sourceHash)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(24)
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1001']
    const recipeIds=new Set([...recipe.entries,...recipe.extraDeckEntries].map(entry=>entry.cardNumber))
    expect(recipeIds).toEqual(sourceIds)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1001').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-1164',intersection:15,union:32})
    expect(overlaps[0]?.jaccard).toBeCloseTo(15/32)
  })
  it('adds the distinct red Red Arena recipe from Cookierift 1174 without substitutions',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===1174)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Red Arena',color:'red',author:'Clannad_is_Life',sourceUpdatedAt:'2026-10-12',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source!.sourceHash).toBe(`sha256:${sourceHash}`)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(21)
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1174']
    const recipeIds=new Set([...recipe.entries,...recipe.extraDeckEntries].map(entry=>entry.cardNumber))
    expect(recipeIds).toEqual(sourceIds)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1174').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-83',intersection:14,union:28})
    expect(overlaps[0]?.jaccard).toBeCloseTo(14/28)
  })
  it('adds the legal black Pierre Poliviere list from Cookierift 1290 with distinct card copies',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===1290)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Pierre Poliviere',color:'black',author:'Punpun',sourceUpdatedAt:'2026-10-17',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source!.sourceHash).toBe(`sha256:${sourceHash}`)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    const countEntries=(entries:readonly {cardNumber:string;count:number}[])=>new Map(entries.map(entry=>[entry.cardNumber,entry.count]))
    const sourceCounts=countEntries([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>{const [cardNumber,count]=entry.split(':');return {cardNumber,count:Number(count)}}))
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1290']
    expect({name:recipe.name,color:recipe.color,author:recipe.author,sourceUrl:recipe.sourceUrl}).toEqual({
      name:source!.name,color:source!.color,author:source!.author,sourceUrl:source!.sourceUrl,
    })
    expect([...recipe.entries,...recipe.extraDeckEntries].map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' '))
      .toBe(`${source!.main} ${source!.extra}`)
    const referenceCounts=countEntries([
      ...COMMUNITY_DECK_PRESETS['cookierift-506'].entries,
      ...COMMUNITY_DECK_PRESETS['cookierift-506'].extraDeckEntries,
    ])
    const sharedCopies=[...sourceCounts].reduce((sum,[cardNumber,count])=>sum+Math.min(count,referenceCounts.get(cardNumber)??0),0)
    expect(sharedCopies).toBe(49)
    expect([...sourceCounts.keys()].filter(cardNumber=>!referenceCounts.has(cardNumber)).sort()).toEqual([
      'BS12-110','BS12-111','P-156','P-162',
    ])
  })
  it('adds the distinct red Basic red list from Cookierift 1295 without substitutions',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===1295)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Basic red',color:'red',author:'atomic',sourceUpdatedAt:'2026-10-17',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source!.sourceHash).toBe(`sha256:${sourceHash}`)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:6})
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(26)
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1295']
    const recipeIds=new Set([...recipe.entries,...recipe.extraDeckEntries].map(entry=>entry.cardNumber))
    expect(recipeIds).toEqual(sourceIds)
    expect([...recipe.entries,...recipe.extraDeckEntries].map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' '))
      .toBe(`${source!.main} ${source!.extra}`)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1295').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-793',intersection:13,union:39})
    expect(overlaps[0]?.jaccard).toBeCloseTo(13/39)
  })
  it('adds the low-overlap yellow Immortal Cheese list from Cookierift 1291 exactly',()=>{
    const source=liveSnapshot.decks.find(deck=>deck.sourceId===1291)
    expect(source).toBeDefined()
    expect({name:source!.name,color:source!.color,author:source!.author,sourceUpdatedAt:source!.sourceUpdatedAt}).toEqual({
      name:'Immortal Cheese (Ver 1)',color:'yellow',author:'homocidalspider',sourceUpdatedAt:'2026-10-17',
    })
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source!.sourceHash).toBe(`sha256:${sourceHash}`)
    const countCards=(list:string)=>list.split(/\s+/).reduce((count,entry)=>count+Number(entry.split(':')[1]),0)
    expect({main:countCards(source!.main),extra:countCards(source!.extra)}).toEqual({main:60,extra:2})
    expect(source!.main).toContain('BS9-041:4')
    expect(source!.main).not.toMatch(/BS9-041@/)
    const sourceIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    expect(sourceIds.size).toBe(27)
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-1291']
    expect([...recipe.entries,...recipe.extraDeckEntries].map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' '))
      .toBe(`${source!.main} ${source!.extra}`)
    const overlaps=Object.entries(COMMUNITY_DECK_PRESETS).filter(([choice])=>choice!=='cookierift-1291').map(([choice,deck])=>{
      const ids=new Set([...deck.entries,...deck.extraDeckEntries].map(entry=>entry.cardNumber))
      const intersection=[...sourceIds].filter(id=>ids.has(id)).length
      const union=new Set([...sourceIds,...ids]).size
      return {choice,intersection,union,jaccard:intersection/union}
    }).sort((left,right)=>right.jaccard-left.jaccard)
    expect(overlaps[0]).toMatchObject({choice:'cookierift-1035',intersection:4,union:43})
    expect(overlaps[0]?.jaccard).toBeCloseTo(4/43)
  })
  it('keeps the latest blue deck quarantined while P-178 is missing from the formal card pool',()=>{
    const source=newestSnapshot.decks.find(deck=>deck.sourceId===1273)
    expect(source?.color).toBe('blue')
    expect(source?.main).toContain('P-178:2')
    expect(COMMUNITY_DECK_PRESETS).not.toHaveProperty('cookierift-1273')
  })
  it('keeps the low-performing unimported six-color recipe quarantined',()=>{
    const source=newestSnapshot.decks.find(deck=>deck.sourceId===1251)
    expect(source).toBeDefined()
    expect(source?.color).toBe('multi')
    expect(source?.main).toContain('BS12-088:3')
    expect(source?.extra).toContain('BS12-111:1')
    expect(COMMUNITY_DECK_PRESETS).not.toHaveProperty('cookierift-1251')
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source!.sourceHash).toBe(`sha256:${sourceHash}`)
  })
  it('quarantines the near-duplicate red community recipe 1272',()=>{
    const source=newestSnapshot.decks.find(deck=>deck.sourceId===1272)
    expect(source).toBeDefined()
    expect(source?.name).toBe('Red Arena')
    expect(source?.color).toBe('multi')
    const sourceCardIds=new Set([...source!.main.split(/\s+/),...source!.extra.split(/\s+/)]
      .filter(Boolean).map(entry=>entry.split(':')[0]))
    const acceptedRecipe=COMMUNITY_DECK_PRESETS['cookierift-83']
    const acceptedCardIds=new Set([...acceptedRecipe.entries,...acceptedRecipe.extraDeckEntries].map(entry=>entry.cardNumber))
    const intersection=[...sourceCardIds].filter(cardId=>acceptedCardIds.has(cardId)).length
    const union=new Set([...sourceCardIds,...acceptedCardIds]).size
    expect({candidateTypes:sourceCardIds.size,acceptedTypes:acceptedCardIds.size,intersection,union}).toEqual({
      candidateTypes:21,acceptedTypes:21,intersection:20,union:22,
    })
    expect(intersection/union).toBeCloseTo(20/22)
    expect(COMMUNITY_DECK_PRESETS).not.toHaveProperty('cookierift-1272')
    const sourceHash=createHash('sha256').update([
      String(source!.sourceId),source!.color,source!.name,source!.author,source!.sourceUrl,
      source!.sourceUpdatedAt,source!.main,source!.extra,
    ].join('\n'),'utf8').digest('hex')
    expect(source!.sourceHash).toBe(`sha256:${sourceHash}`)
  })
  it('uses the latest captured source metadata and complete card list for Cookierift 973',()=>{
    const source=previousSnapshot.decks.find(deck=>deck.sourceId===973)
    expect(source).toBeDefined()
    const recipe=COMMUNITY_DECK_PRESETS['cookierift-973']
    expect({name:recipe.name,color:recipe.color,author:recipe.author,sourceUrl:recipe.sourceUrl}).toEqual({
      name:source!.name,
      color:source!.color,
      author:source!.author,
      sourceUrl:source!.sourceUrl
    })
    expect(recipe.entries.map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' ')).toBe(source!.main)
    expect(recipe.extraDeckEntries.map(({cardNumber,count})=>`${cardNumber}:${count}`).join(' ')).toBe(source!.extra)
  })
})
