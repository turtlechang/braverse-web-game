import { describe, expect, it } from 'vitest'
import {
  MATCHUP_PROFILES,
  scoreAttackTarget,
  scoreReplacementAdvanced,
} from './ai/bs2MatchupProfiles'
import { createBattleState } from './test-helpers/battle-helpers'
import type { CardSkill, CookieCard, CookieInBattle, GameCard, GameState } from './types'

/**
 * 「方向 3」：EFFECT_VALUE_BONUS／attackThreatValues 查無資料（也就是任何
 * 未收錄進 bs2MatchupProfiles.ts 手刻表的卡，包括這次新增的 BS3 五套牌組）
 * 時，不再退回一個跟卡片實際效果無關的中性預設值，改用
 * ai/skill-value.ts 直接讀 card.skill.effects 推算。這裡驗證兩件事：
 * 1. 已收錄的舊卡分數完全不受影響（fallback 不能覆蓋手刻調校過的數字）。
 * 2. 沒收錄的新卡（用 BS3 卡號但表格查不到）能拿到跟其技能強弱成比例的
 *    分數，而不是每張都一樣。
 */

const boardContext = {
  myBreakLevel: 9,
  oppBreakLevel: 9,
  myBattleAreaCount: 2,
  myTotalBattleHp: 5,
  oppTotalBattleHp: 5,
}

const redProfile = MATCHUP_PROFILES.red

const damageSkill: CardSkill = {
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

const healSkill: CardSkill = {
  trigger: 'activate',
  oncePerTurn: false,
  yourTurn: false,
  restSource: false,
  cost: { energy: { red: 1 }, discardHand: 0 },
  text: '回血',
  effects: [{ kind: 'gain-hp', amount: 2 }],
}

const bs3Vanilla: GameCard = {
  id: 'BS3-999',
  instanceId: 'bs3-vanilla',
  name: 'BS3 未收錄雜牌',
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 1,
}

const bs3Damage: GameCard = {
  ...bs3Vanilla,
  id: 'BS3-998',
  instanceId: 'bs3-damage',
  name: 'BS3 未收錄傷害卡',
  skill: damageSkill,
}

describe('R6b/攻擊目標評分：查無資料時改用技能結構推算（方向 3）', () => {
  it('已收錄的舊卡（Rebel Cookie／BS2-003）效果加分完全不受影響', () => {
    const rebel: GameCard = {
      id: 'BS2-003',
      instanceId: 'rebel-1',
      name: 'Rebel Cookie',
      type: 'cookie',
      level: 3,
      hp: 3,
      attack: 3,
      attackCost: 3,
    }
    const withHandTuned = scoreReplacementAdvanced(rebel, redProfile, 'safe', boardContext)
    // 手刻表格 BS2-003 的 effectBonus 是 8；就算給它掛上完全不同的技能，
    // 只要 id 在表裡就該用表格的數字，不能被技能推算蓋過去。
    const withDifferentSkill = scoreReplacementAdvanced(
      { ...rebel, skill: healSkill },
      redProfile,
      'safe',
      boardContext,
    )
    expect(withDifferentSkill).toBe(withHandTuned)
  })

  it('BS3 未收錄的卡，有免費被動傷害技能分數高於完全沒有技能的雜牌', () => {
    const vanillaScore = scoreReplacementAdvanced(bs3Vanilla, redProfile, 'safe', boardContext)
    const damageScore = scoreReplacementAdvanced(bs3Damage, redProfile, 'safe', boardContext)
    expect(damageScore).toBeGreaterThan(vanillaScore)
  })

  it('BS3 未收錄、有回血技能的卡，我方破壞區偏高時能拿到防守加成', () => {
    const bs3Healer: GameCard = { ...bs3Vanilla, id: 'BS3-997', instanceId: 'bs3-healer', skill: healSkill }
    const withoutSkill = scoreReplacementAdvanced(bs3Vanilla, redProfile, 'safe', boardContext)
    const withHealSkill = scoreReplacementAdvanced(bs3Healer, redProfile, 'safe', boardContext)
    // 兩張卡基礎數值一樣，差別只在有沒有回血技能；我方破壞區 9（>=8）時
    // 應該吃到防守型的 +6 board-need bonus。
    expect(withHealSkill).toBeGreaterThan(withoutSkill)
  })

  it('攻擊目標威脅值：BS3 未收錄的卡按攻擊力/等級/技能推算，不是每張都拿 50', () => {
    const state: GameState = createBattleState()
    const weakTarget: CookieInBattle = {
      card: { ...bs3Vanilla, attack: 1, level: 1 } as CookieCard,
      hpCards: [],
      rested: false,
      battleEntryId: 'weak:battle:1',
    }
    const strongTarget: CookieInBattle = {
      card: { ...bs3Damage, attack: 4, level: 3 } as CookieCard,
      hpCards: [],
      rested: false,
      battleEntryId: 'strong:battle:1',
    }
    const weakScore = scoreAttackTarget(weakTarget, redProfile, state, 'player-two')
    const strongScore = scoreAttackTarget(strongTarget, redProfile, state, 'player-two')
    expect(strongScore).toBeGreaterThan(weakScore)
  })
})
