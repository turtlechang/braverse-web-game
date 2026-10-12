import inventory from '../../data/decks/cookierift-community-20261010.json'
import type { StarterDeckEntry } from './starter-deck'

export type CommunityDeckChoice = 'cookierift-921' | 'cookierift-927' | 'cookierift-67' |
  'cookierift-83' | 'cookierift-568' | 'cookierift-506'

const parseEntries = (text:string):StarterDeckEntry[] => text.split(/\s+/).map(part=>{
  const match=/^([A-Z0-9]+-\d{3}):(\d+)$/.exec(part)
  if(!match)throw new Error(`Invalid community recipe entry: ${part}`)
  return {cardNumber:match[1],count:Number(match[2])}
})

// Explicit acceptance list. Other collected recipes remain quarantined without substitutions.
const accepted = [921,927,67,83,568,506] as const
export const COMMUNITY_DECK_PRESETS = Object.fromEntries(accepted.map(sourceId=>{
  const source=inventory.decks.find(deck=>deck.sourceId===sourceId)
  if(!source)throw new Error(`Missing Cookierift source ${sourceId}`)
  return [`cookierift-${sourceId}`,{name:source.name,color:source.color,
    sourceUrl:`https://cookierift.com/decks/community/${sourceId}`,author:source.author,
    entries:parseEntries(source.main),extraDeckEntries:parseEntries(source.extra)}]
})) as Record<CommunityDeckChoice,{name:string;color:string;sourceUrl:string;author:string;
  entries:StarterDeckEntry[];extraDeckEntries:StarterDeckEntry[]}>
