import { describe, expect, it } from 'vitest'
import { takeAiStep } from '../../ai'
import { getAttackDamageAgainst } from '../../effects'
import { createBattleState, cookie, item } from '../../test-helpers/battle-helpers'

describe('Lv5 target-specific public attack damage', () => {
  it('attacks the vulnerable Cookie instead of a higher-level target with public damage immunity', () => {
    const state = createBattleState()
    state.players['player-two'].hand = []
    const protectedCard = {...cookie('protected', 1, 3), level:3}
    state.players['player-one'].battleArea.push({card:protectedCard,
      hpCards:[item('hp-a'),item('hp-b'),item('hp-c')],rested:false})
    state.damageReceivedModifiers = [{sourceInstanceId:'protected',targetInstanceId:'protected',
      amount:-3,damageType:'attack',expiresAfterTurn:2}]
    expect(getAttackDamageAgainst(state,'attacker','protected')).toBe(0)
    expect(getAttackDamageAgainst(state,'attacker','defender')).toBe(3)
    const snapshot = JSON.stringify(state)
    const decision = takeAiStep(state,'player-two',{level:5,seed:17,searchNow:()=>0})
    expect(decision.action).toBe('attack')
    expect(decision.state.pendingBattle?.targetInstanceId).toBe('defender')
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})
