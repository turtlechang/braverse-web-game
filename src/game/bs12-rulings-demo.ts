import {applyGameCommand,type GameCommand} from './commands'
import {getCurrentReplacementTask} from './replacement'
import type {GameState,CookieCard,GameCard,ExtraDeckCard,PlayerId} from './types'

/** Local preview factories use only original printed cards and actual commands. */
export const createBs12RulingLifecycleFactories=(fixture:{base:()=>GameState;printed:(number:string,id:string)=>GameCard;extra:(number:string,id:string)=>ExtraDeckCard;owner?:PlayerId})=>{
const owner=fixture.owner??'player-one',foe:PlayerId=owner==='player-one'?'player-two':'player-one'
const printed=fixture.printed
const cookie=(number:string,id:string):CookieCard=>{const c=printed(number,id);if(c.type!=='cookie')throw Error('Expected printed Cookie '+number);return c}
const extra=fixture.extra
const fill=(prefix:string)=>['BS12-028','BS12-029','BS12-030','BS12-031','BS12-046','BS12-047','BS12-048','BS12-049','BS12-065','BS12-066','BS12-067','BS12-068','BS12-069','BS12-083','BS12-084','BS12-086','BS12-087','BS12-102','BS12-103','BS12-104','BS12-105'].flatMap(n=>[n,n]).map((n,i)=>printed(n,prefix+'-'+i))
const entry=(number:string,id:string,hpNumbers:string[])=>({card:cookie(number,id),hpCards:hpNumbers.map((n,i)=>printed(n,id+'-hp-'+i)),rested:false,battleEntryId:id+':battle:initial'})
const lifecycleBase=():GameState=>{
 const base=fixture.base()
 return {...base,turnNumber:2,firstPlayerId:foe,activePlayerId:owner,phase:'main',commandLog:[],players:{
  ...base.players,
  [owner]:{...base.players[owner],hand:[],deck:fill('life-own-deck'),battleArea:[],supportArea:[],discardPile:[],breakArea:[],stage:null,extraDeck:[]},
  [foe]:{...base.players[foe],hand:[],deck:fill('life-foe-deck'),battleArea:[entry('BS6-008','life-foe',['BS12-009','BS12-010','BS12-011','BS12-012','BS12-013','BS12-014'])],supportArea:[],discardPile:[],breakArea:[],stage:null,extraDeck:[]},
 }}
}
const command=(state:GameState,command:GameCommand)=>applyGameCommand(state,command)
const declineReplacement=(state:GameState)=>{let next=state;for(let i=0;next.pendingReplacement&&i<4;i++){const task=getCurrentReplacementTask(next);if(!task)throw Error('Missing replacement task');next=command(next,{kind:'skip-replacement',playerId:task.playerId})}return next}
const advanceTo=(before:GameState,playerId:typeof owner|typeof foe)=>{
 let state=before
 // At least finish the current turn; normal Active/Draw/Support commands reset flags and draw printed cards.
 state=command(state,{kind:'advance-phase',playerId:state.activePlayerId})
 for(let i=0;i<20&&(state.activePlayerId!==playerId||state.phase!=='main');i++)state=command(state,{kind:'advance-phase',playerId:state.activePlayerId})
 if(state.activePlayerId!==playerId||state.phase!=='main')throw Error('Could not advance to normal main phase')
 return state
}
const createActualAwakenParent=()=>{
 let state=lifecycleBase()
 state={...state,players:{...state.players,[owner]:{...state.players[owner],
  battleArea:[entry('BS12-109','life-companion',['BS12-012','BS12-013']),entry('BS8-119','life-crunchy',['BS12-009','BS12-010','BS12-011'])],
  hand:[printed('BS12-014','life-awaken-fee')],discardPile:[printed('BS11-087','life-cacao')],extraDeck:[extra('BS8-104','life-awaken')],
  supportArea:[{card:printed('BS12-075','life-purple-support'),rested:false}],
 },[foe]:{...state.players[foe],hand:[printed('BS6-080','life-adventurer')]}}}
 state=command(state,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:'life-crunchy',trigger:'activate',paymentIds:['life-purple-support']})
 state=command(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:['life-cacao']})
 state=command(state,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:'life-cacao',trigger:'on-play',paymentIds:[]})
 state=command(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:['life-cacao']})
 state=declineReplacement(state)
 state=command(state,{kind:'play-extra-deck-cookie',playerId:owner,instanceId:'life-awaken'})
 state=command(state,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:'life-awaken',trigger:'on-play',paymentIds:[],discardHandIds:['life-awaken-fee']})
 state=command(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
 return state
}
const openActualAwakenReturn=()=>{
 let state=advanceTo(createActualAwakenParent(),foe)
 state=command(state,{kind:'deploy-cookie',playerId:foe,instanceId:'life-adventurer'})
 state=command(state,{kind:'begin-activate-skill',playerId:foe,sourceInstanceId:'life-adventurer',trigger:'on-play',paymentIds:[]})
 return state
}
const createActualExtraDeckReturnParent=(number:'BS12-036'|'BS12-036@1'='BS12-036')=>{
 let state=lifecycleBase()
 state={...state,players:{...state.players,[owner]:{...state.players[owner],
  battleArea:[entry('BS12-072','life-cream-soda',['BS12-012','BS12-013','BS12-014'])],
  breakArea:['BS12-024','BS12-025','BS12-032','BS12-034'].map((n,i)=>cookie(n,'life-break-'+i)),
  extraDeck:[extra(number,'life-clotted'),extra('BS12-074','life-next-extra')],
  supportArea:[{card:printed('ST4-001','life-blue-support'),rested:false}],
 },[foe]:{...state.players[foe],hand:[printed('BS6-080','life-adventurer')]}}}
 state=command(state,{kind:'play-extra-deck-cookie',playerId:owner,instanceId:'life-clotted'})
 state=command(state,{kind:'skip-on-play',playerId:owner,sourceInstanceId:'life-clotted'})
 return state
}
const returnActualExtraToDeck=(before:GameState)=>{
 let state=command(before,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:'life-cream-soda',trigger:'activate',paymentIds:['life-blue-support']})
 state=command(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:['life-clotted']})
 return state
}

/** Actual printed EXTRA -> Break -> Trash sequence; no rewritten card attributes. */
const createActualExtraTrashParent=()=>{
 let state=lifecycleBase()
 state={...state,players:{...state.players,[owner]:{...state.players[owner],
  battleArea:[entry('BS12-109','life-companion',['BS12-012','BS12-013'])],
  hand:[printed('BS12-024','life-extra-fee'),printed('BS1-037','life-timekeeper'),printed('BS12-014','life-time-fee'),printed('BS12-085','life-rainbow'),printed('BS7-102','life-kohlrabi')],
  breakArea:['BS12-024','BS12-025','BS12-032','BS12-034'].map((n,i)=>cookie(n,'life-break-'+i)),
  discardPile:['BS12-081','BS12-081','BS12-088','BS12-088','BS12-089'].map((n,i)=>printed(n,'life-blocker-'+i)),
  extraDeck:[extra('BS12-018','life-glitter'),extra('BS12-036','life-clotted')],
  supportArea:['BS12-024','BS12-025','BS12-032','BS12-034','BS12-019','BS12-075','BS12-081','BS12-079'].map((n,i)=>({card:printed(n,'life-support-'+i),rested:false})),
 },[foe]:{...state.players[foe],hand:[printed('BS6-080','life-adventurer'),printed('BS6-080','life-adventurer-second')]}}}
 state=command(state,{kind:'play-extra-deck-cookie',playerId:owner,instanceId:'life-glitter'})
 state=command(state,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',discardCardIds:['life-extra-fee'],paymentIds:[]})
 state=advanceTo(state,foe)
 state=command(state,{kind:'deploy-cookie',playerId:foe,instanceId:'life-adventurer'})
 state=command(state,{kind:'begin-activate-skill',playerId:foe,sourceInstanceId:'life-adventurer',trigger:'on-play',paymentIds:[]})
 state=command(state,{kind:'resolve-ability-effect',playerId:foe,targetIds:['life-companion']})
 state=advanceTo(state,owner)
 state=command(state,{kind:'play-extra-deck-cookie',playerId:owner,instanceId:'life-clotted'})
 state=command(state,{kind:'skip-on-play',playerId:owner,sourceInstanceId:'life-clotted'})
 state=command(state,{kind:'declare-attack',playerId:owner,attackerInstanceId:'life-clotted',targetInstanceId:'life-adventurer',supportPaymentIds:['life-support-0','life-support-1','life-support-2']})
 state=command(state,{kind:'skip-trap',playerId:foe})
 for(let i=0;state.pendingBattle?.stage==='damage'&&i<10;i++)state=command(state,{kind:'resolve-next-damage',playerId:foe})
 state=command(state,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
 state=command(state,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',cookieToBreakAreaIds:['life-glitter'],paymentIds:[]})
 state=command(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
 state=declineReplacement(state)
 state=command(state,{kind:'deploy-cookie',playerId:owner,instanceId:'life-timekeeper'})
 state=command(state,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:'life-timekeeper',trigger:'on-play',paymentIds:['life-support-3','life-support-4'],discardHandIds:['life-time-fee']})
 state=command(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:['life-glitter']})
 return state
}

const createActualMainDeckCostParent=()=>{
 let state=advanceTo(createActualExtraTrashParent(),foe)
 state=command(state,{kind:'deploy-cookie',playerId:foe,instanceId:'life-adventurer-second'})
 state=command(state,{kind:'begin-activate-skill',playerId:foe,sourceInstanceId:'life-adventurer-second',trigger:'on-play',paymentIds:[]})
 state=command(state,{kind:'resolve-ability-effect',playerId:foe,targetIds:['life-timekeeper']})
 state=advanceTo(state,owner)
 state=command(state,{kind:'deploy-cookie',playerId:owner,instanceId:'life-kohlrabi'})
 state=command(state,{kind:'declare-attack',playerId:owner,attackerInstanceId:'life-kohlrabi',targetInstanceId:'life-foe',supportPaymentIds:['life-support-5']})
 state=command(state,{kind:'skip-trap',playerId:foe})
 state=command(state,{kind:'resolve-next-damage',playerId:foe})
 state=command(state,{kind:'resolve-attack-effect',playerId:owner,targetIds:[]})
 return state
}

return {lifecycleBase,command,declineReplacement,advanceTo,createActualAwakenParent,openActualAwakenReturn,createActualExtraDeckReturnParent,returnActualExtraToDeck,createActualExtraTrashParent,createActualMainDeckCostParent}
}
