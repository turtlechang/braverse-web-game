import type {GameState,PlayerId} from '../types'
import {maskGameStateForViewer} from '../masked-state'
import {createPlayerView} from '../player-view'
import {applyGameCommand} from '../commands'
import {selectSafeOptionalDrawCount} from './optional-draw-refresh-safety'

/** Forecast actual payment before spending resources on a draw to decline. */
export const paysForZeroSafeDraw=(state:GameState,playerId:PlayerId,discardCardIds:string[],paymentIds:string[]):boolean=>{
 const pending=state.pendingOptionalCostAttack
 if(!pending||pending.playerId!==playerId||pending.mandatory||pending.effects.length!==1)return false
 const effect=pending.effects[0]
 if(effect.kind!=='draw-up-to'||effect.max<1||Object.entries(effect).some(([key,value])=>value!==undefined&&!['kind','max'].includes(key)))return false
 if(Object.entries(pending.cost).some(([key,value])=>value!==undefined&&!['energy','discardHand','discardHandType','discardHandHasFlip'].includes(key)))return false
 if(!discardCardIds.length&&!paymentIds.length)return false
 const masked=maskGameStateForViewer({...state,commandLog:undefined},playerId)
 const paid=applyGameCommand(masked,{kind:'resolve-optional-cost-attack',playerId,action:'pay',discardCardIds,paymentIds,targetIds:[]})
 const draw=paid.pendingDrawUpTo
 return Boolean(draw&&draw.playerId===playerId&&selectSafeOptionalDrawCount(createPlayerView(paid,playerId),draw.max)===0)
}
