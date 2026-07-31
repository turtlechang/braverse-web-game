import { describe, expect, it } from 'vitest'
import { evaluateTrapWorth } from './battle-handler'
import { createBattleState, declareAttack } from '../test-helpers/battle-helpers'
import type { CardSkill, CookieCard, GameCard, GameState } from '../types'

/**
 * R7 陷阱評分裡的「保護高效果價值目標加分」原本是一份寫死的卡名子字串
 * 清單（'Rebel'、'Dark Choco'、'Sea Fairy'……），只涵蓋 BS1／BS2 少數幾張
 * 卡，而且用 `card.name.includes(...)` 比對——跟 bs2MatchupProfiles.ts 在
 * 414dae9 之前的問題一模一樣：同名跨彈重印卡會被誤套，BS3 卡片不管技能
 * 多強都拿不到這個加分。這裡驗證改用 getCardEffectValue 之後兩件事都修好
 * 了。
 */

const passiveDamageSkill: CardSkill = {
  trigger: 'passive',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: {}, discardHand: 0 },
  text: '免費被動傷害',
  effects: [
    { kind: 'damage', amount: 3, target: { side: 'opponent', min: 0, max: 1 } },
  ],
}

const trapCard: GameCard = {
  id: 'test-trap',
  instanceId: 'test-trap-1',
  name: '測試陷阱',
  type: 'trap',
  trap: {
    text: '測試用',
    cost: { energy: {}, discardHand: 0 },
    effects: [
      { kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
    ],
  },
}

const withDefender = (card: CookieCard): GameState => {
  const base = createBattleState()
  const state: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        battleArea: [
          { ...base.players['player-one'].battleArea[0], card },
        ],
      },
    },
  }
  return declareAttack(state)
}

describe('evaluateTrapWorth：保護目標的效果價值加分改用 getCardEffectValue', () => {
  it('已收錄的高效果價值卡（Rebel Cookie／BS2-003）仍然拿到加分', () => {
    const defender: CookieCard = {
      id: 'BS2-003',
      instanceId: 'defender',
      name: 'Rebel Cookie',
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 3,
      attackCost: 3,
    }
    const state = withDefender(defender)
    const withBonus = evaluateTrapWorth(state, 'player-one', trapCard, state.pendingBattle!)

    const vanilla: CookieCard = { ...defender, id: 'test-vanilla-1' }
    const stateVanilla = withDefender(vanilla)
    const withoutBonus = evaluateTrapWorth(
      stateVanilla,
      'player-one',
      trapCard,
      stateVanilla.pendingBattle!,
    )

    expect(withBonus).toBe(withoutBonus + 20)
  })

  it('BS3 未收錄、但有等量強度技能的卡也能拿到加分（原本的卡名清單完全涵蓋不到）', () => {
    const bs3WithSkill: CookieCard = {
      id: 'BS3-999',
      instanceId: 'defender',
      name: 'BS3 未收錄卡',
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 2,
      attackCost: 1,
      skill: passiveDamageSkill,
    }
    const state = withDefender(bs3WithSkill)
    const withSkillScore = evaluateTrapWorth(state, 'player-one', trapCard, state.pendingBattle!)

    const bs3Vanilla: CookieCard = { ...bs3WithSkill, id: 'BS3-998', skill: undefined }
    const stateVanilla = withDefender(bs3Vanilla)
    const vanillaScore = evaluateTrapWorth(
      stateVanilla,
      'player-one',
      trapCard,
      stateVanilla.pendingBattle!,
    )

    expect(withSkillScore).toBe(vanillaScore + 20)
  })

  it('同名不同卡不會互相誤套（BS3-009 跟 BS1-012 都叫 Wildberry Cookie，但技能不同）', () => {
    // 舊版用 name.includes('Wildberry') 之類的清單不會誤套 Wildberry（原本
    // 清單裡也沒有這個名字），但這裡驗證的是更根本的原則：分數只看
    // card.id／card.skill，同名字完全不影響判斷。
    const namedLikeKnownCard: CookieCard = {
      id: 'BS3-997',
      instanceId: 'defender',
      name: 'Rebel Cookie', // 跟 BS2-003 同名，但 id 不同、也沒有技能
      type: 'cookie',
      level: 2,
      hp: 3,
      attack: 2,
      attackCost: 1,
    }
    const state = withDefender(namedLikeKnownCard)
    const score = evaluateTrapWorth(state, 'player-one', trapCard, state.pendingBattle!)

    const trulyVanilla: CookieCard = { ...namedLikeKnownCard, id: 'test-vanilla-2', name: '其他名字' }
    const stateVanilla = withDefender(trulyVanilla)
    const vanillaScore = evaluateTrapWorth(
      stateVanilla,
      'player-one',
      trapCard,
      stateVanilla.pendingBattle!,
    )

    // 同名不该觸發加分——分數應該跟完全不同名字的雜牌一樣
    expect(score).toBe(vanillaScore)
  })
})
