import {createSt8010PreviewState} from './st8-010-demo'
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

/** Swap the real prepared decks, then regenerate all actual parent commands. */
export const createSt8010AiPreviewState=(scenario:'positive'|'negative',prepareOnly=false):GameState=>{
  const route=scenario==='positive'?'positive':'no-item'
  let state=swap(createSt8010PreviewState(route,true)) as GameState
  if(prepareOnly)return state
  for(const entry of createSt8010PreviewState(route).commandLog??[])
    state=applyGameCommand(state,swap(commandFromLogEntry(entry)) as GameCommand)
  return state
}
