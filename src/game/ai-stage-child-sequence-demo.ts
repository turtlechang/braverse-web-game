import trace from './fixtures/ai-stage-child-loop.json'
import {createCustomDeckMatch} from './tournament'
import type {SwissRosterDeck} from './tournament'
import {applyGameCommand} from './commands'
import type {GameCommand} from './commands'

/** Original opening plus 138 successful commands, immediately before the stalled completion. */
export const createAiStageChildSequenceOpening=()=>createCustomDeckMatch(trace.seed,trace.recipe as SwissRosterDeck,trace.recipe as SwissRosterDeck,'player-two')
export const createAiStageChildSequencePreview=()=>{
 let state=createAiStageChildSequenceOpening()
 for(const command of trace.commands as GameCommand[])state=applyGameCommand(state,command)
 return state
}
