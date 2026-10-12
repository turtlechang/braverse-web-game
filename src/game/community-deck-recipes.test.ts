import { describe, expect, it } from 'vitest'
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
    expect(Object.keys(COMMUNITY_DECK_PRESETS)).toEqual(['cookierift-921','cookierift-927','cookierift-67','cookierift-83','cookierift-568','cookierift-506'])
    expect(new Set(Object.values(COMMUNITY_DECK_PRESETS).map(deck=>deck.color)).size).toBe(6)
  })
})
