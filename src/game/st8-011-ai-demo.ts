import {createSt8011PreviewState} from './st8-011-demo'
import {applyGameCommand,type GameCommand} from './commands'
import type {GameState} from './types'
import {commandFromLogEntry} from './replay'

const swapText=(text:string)=>text.replaceAll('player-one','player-swap')
  .replaceAll('player-two','player-one').replaceAll('player-swap','player-two')
const swap=(value:unknown):unknown=>{
  if(typeof value==='string')return swapText(value)
  if(Array.isArray(value))return value.map(swap)
  if(value!==null&&typeof value==='object')return Object.fromEntries(
    Object.entries(value).map(([key,item])=>[swapText(key),swap(item)]))
  return value
}

/** Regenerate real attacks after swapping prepared original decks. */
export const createSt8011AiPreviewState=(scenario:'positive'|'negative',prepareOnly=false):GameState=>{
  const route=scenario==='positive'?'damage-two':'wrong-color'
  let state=swap(createSt8011PreviewState(route,true)) as GameState
  if(prepareOnly)return state
  for(const entry of createSt8011PreviewState(route).commandLog??[])
    state=applyGameCommand(state,swap(commandFromLogEntry(entry)) as GameCommand)
  return state
}
