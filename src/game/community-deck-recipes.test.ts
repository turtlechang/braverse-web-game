import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import currentSnapshot from '../../data/decks/cookierift-community-20261014.json'
import latestSnapshot from '../../data/decks/cookierift-community-20261015.json'
import newestSnapshot from '../../data/decks/cookierift-community-20261016.json'
import silentSnapshot from '../../data/decks/cookierift-community-20261016-silent.json'
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
      'cookierift-1164','cookierift-1239','cookierift-1151','cookierift-1259','cookierift-1207',
    ])
    expect(new Set(Object.values(COMMUNITY_DECK_PRESETS).map(deck=>deck.color)).size).toBe(6)
  })
  it.each([...silentSnapshot.decks,...newestSnapshot.decks.filter(source=>source.sourceId!==1273&&source.sourceId!==1251),...latestSnapshot.decks,...currentSnapshot.decks.filter(source=>source.sourceId!==51)])('preserves the exact playable Cookierift source record $sourceId',source=>{
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
