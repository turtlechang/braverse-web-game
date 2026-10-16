import {createSt8008PreviewState} from './st8-008-demo'
import {applyGameCommand} from './commands'
import type {GameCommand} from './commands'
import type {GameState} from './types'
import {commandFromLogEntry} from './replay'

const swapText = (text:string) => text.replaceAll('player-one','player-swap')
  .replaceAll('player-two','player-one').replaceAll('player-swap','player-two')
const swap = (value:unknown):unknown => {
  if(typeof value==='string')return swapText(value)
  if(Array.isArray(value))return value.map(swap)
  if(value!==null&&typeof value==='object')return Object.fromEntries(
    Object.entries(value).map(([key,item])=>[swapText(key),swap(item)]))
  return value
}

/** Swap only the prepared physical state, then regenerate canonical parent logs. */
export const createSt8008AiPreviewState = (scenario:'positive'|'negative',prepareOnly=false):GameState => {
  let state=swap(createSt8008PreviewState(scenario,true)) as GameState
  if(prepareOnly)return state
  for(const entry of createSt8008PreviewState(scenario).commandLog??[]) {
    state=applyGameCommand(state,swap(commandFromLogEntry(entry)) as GameCommand)
  }
  return state
}
