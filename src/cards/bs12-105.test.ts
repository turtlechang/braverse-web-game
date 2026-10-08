import {expect,it} from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior} from './contracts/ledger'

const source=candidate.cards.find(card=>card.cardNumber==='BS12-105') as OfficialCardRecord
const error='BS12-105 lacks black Arena K1 Trap, same own battle Cookie black and Arena condition or optional opponent current-turn minus two'

it('105 K1 Trap condition checks one own black Arena battle Cookie and optionally reduces any opponent Cookie by two this turn',()=>{
  const snapshot=structuredClone(source), result=convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({status:'converted',gameCard:{id:'BS12-105',name:'Perfect Stage',type:'trap',cardColor:'black',energyColor:'black',keywords:['arena'],
    imageUrl:'https://cookierunbraverse.com/data/en_storage/-hfHyZuO58hmPQdpYkT7SA.webp',
    trap:{cost:{energy:{black:1},discardHand:0},effects:[{kind:'modify-attack',amount:-2,duration:'this-turn',target:{side:'opponent',min:0,max:1},
      condition:{kind:'battle-area-has-color',side:'self',color:'black',keyword:'arena'}}]}}})
  if(result.status!=='converted'||!result.gameCard.trap) throw new Error('Missing Perfect Stage Trap')
  expect(result.gameCard.trap.condition).toBeUndefined()
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['name','color','energy-color','arena','no-trap','free','wrong-energy','extra-energy','discard','source-energy','alternative','conditional-cost','trap-condition',
  'no-effects','extra-effect','no-condition','wrong-condition','wrong-side','no-keyword','wrong-keyword','split-condition','required-target','self-target','two-targets',
  'arena-target','black-target','special-target','level-target','rested-target','attacker-only','source-only','one-reduction','three-reduction','plus-two','persistent','next-turn','then-draw'] as const)(
  '105 strict rejects runtime semantic mutation: %s',mutation=>{
    const result=convertOfficialCardToGameCard(source)
    if(result.status!=='converted'||!result.gameCard.trap) throw new Error('Missing Perfect Stage Trap')
    const card=structuredClone(result.gameCard),trap=card.trap!,effect=trap.effects[0]
    if(effect.kind!=='modify-attack'||effect.condition?.kind!=='battle-area-has-color') throw new Error('Missing conditional reduction')
    const condition=effect.condition
    if(mutation==='name') card.name='Wrong Trap'
    if(mutation==='color') card.cardColor='purple'
    if(mutation==='energy-color') card.energyColor='purple'
    if(mutation==='arena') card.keywords=[]
    if(mutation==='no-trap') card.trap=undefined
    if(mutation==='free') trap.cost.energy={}
    if(mutation==='wrong-energy') trap.cost.energy={purple:1}
    if(mutation==='extra-energy') trap.cost.energy={black:1,neutral:1}
    if(mutation==='discard') trap.cost.discardHand=1
    if(mutation==='source-energy') trap.sourceEnergy={black:1}
    if(mutation==='alternative') trap.alternativeCosts=[{energy:{}}]
    if(mutation==='conditional-cost') trap.conditionalCost={condition:{kind:'break-level-at-least',level:0},cost:{energy:{}}}
    if(mutation==='trap-condition') trap.condition={kind:'battle-area-has-keyword',keyword:'arena'}
    if(mutation==='no-effects') trap.effects=[]
    if(mutation==='extra-effect') trap.effects.push({kind:'draw',amount:1})
    if(mutation==='no-condition') effect.condition=undefined
    if(mutation==='wrong-condition') effect.condition={kind:'battle-area-has-keyword',side:'self',keyword:'arena'}
    if(mutation==='wrong-side') condition.side='opponent'
    if(mutation==='no-keyword') condition.keyword=undefined
    if(mutation==='wrong-keyword') condition.keyword='ancient'
    if(mutation==='split-condition') effect.condition={kind:'all-of',conditions:[{kind:'battle-area-has-color',side:'self',color:'black'},{kind:'battle-area-has-keyword',side:'self',keyword:'arena'}]}
    if(mutation==='required-target') effect.target.min=1
    if(mutation==='self-target') effect.target.side='self'
    if(mutation==='two-targets') effect.target.max=2
    if(mutation==='arena-target') effect.target.keyword='arena'
    if(mutation==='black-target') effect.target.energyColor='black'
    if(mutation==='special-target') effect.target.hasSpecialPlay=true
    if(mutation==='level-target') effect.target.maxLevel=1
    if(mutation==='rested-target') effect.target.restedOnly=true
    if(mutation==='attacker-only') effect.target.attackTargetOnly=true
    if(mutation==='source-only') effect.target.sourceOnly=true
    if(mutation==='one-reduction') effect.amount=-1
    if(mutation==='three-reduction') effect.amount=-3
    if(mutation==='plus-two') effect.amount=2
    if(mutation==='persistent') effect.duration='persistent'
    if(mutation==='next-turn') effect.duration='own-next-turn'
    if(mutation==='then-draw') effect.thenEffects=[{kind:'draw',amount:1}]
    expect(analyzeOfficialCardBehavior(source,card).errors).toContain(error)
  })
