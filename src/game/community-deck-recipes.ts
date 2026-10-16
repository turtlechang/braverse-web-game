import inventory from '../../data/decks/cookierift-community-20261010.json'
import previousSnapshot from '../../data/decks/cookierift-community-20261013.json'
import currentSnapshot from '../../data/decks/cookierift-community-20261014.json'
import latestSnapshot from '../../data/decks/cookierift-community-20261015.json'
import newestSnapshot from '../../data/decks/cookierift-community-20261016.json'
import silentSnapshot from '../../data/decks/cookierift-community-20261016-silent.json'
import type { StarterDeckEntry } from './starter-deck'

export type CommunityDeckChoice = 'cookierift-921' | 'cookierift-927' | 'cookierift-67' |
  'cookierift-83' | 'cookierift-568' | 'cookierift-506' | 'cookierift-1035' |
  'cookierift-793' | 'cookierift-973' | 'cookierift-16' | 'cookierift-731' | 'cookierift-801' |
  'cookierift-1164' | 'cookierift-1239' | 'cookierift-1151' | 'cookierift-1259' | 'cookierift-1207'

const parseEntries = (text:string):StarterDeckEntry[] => text.trim() ? text.trim().split(/\s+/).map(part=>{
  const match=/^([A-Z0-9]+-\d{3}):(\d+)$/.exec(part)
  if(!match)throw new Error(`Invalid community recipe entry: ${part}`)
  return {cardNumber:match[1],count:Number(match[2])}
}) : []

// Explicit acceptance list. Other collected recipes remain quarantined without substitutions.
// Newer snapshots come first so duplicate source IDs use the latest captured recipe.
const sources = [...silentSnapshot.decks, ...newestSnapshot.decks, ...latestSnapshot.decks, ...currentSnapshot.decks, ...previousSnapshot.decks, ...inventory.decks]
const accepted = [921,927,67,83,568,506,1035,793,973,16,731,801,1164,1239,1151,1259,1207] as const
export const COMMUNITY_DECK_PRESETS = Object.fromEntries(accepted.map(sourceId=>{
  const source=sources.find(deck=>deck.sourceId===sourceId)
  if(!source)throw new Error(`Missing Cookierift source ${sourceId}`)
  const sourceUrl='sourceUrl' in source && typeof source.sourceUrl==='string'
    ? source.sourceUrl
    : `https://cookierift.com/decks/community/${sourceId}`
  return [`cookierift-${sourceId}`,{name:source.name,color:source.color,sourceUrl,author:source.author,
    entries:parseEntries(source.main),extraDeckEntries:parseEntries(source.extra)}]
})) as Record<CommunityDeckChoice,{name:string;color:string;sourceUrl:string;author:string;
  entries:StarterDeckEntry[];extraDeckEntries:StarterDeckEntry[]}>
