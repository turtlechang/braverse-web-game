import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
} from './demo'
import {
  getAttackResponseSkillCandidates,
  playAttackResponseSkill,
  skipTrap,
} from './battle'
import { getTrashToDeckCostCandidates } from './skills'
import type { CookieCard, GameState } from './types'
import {
  cookie,
  createBattleState,
  declareAttack,
  item,
} from './test-helpers/battle-helpers'

/**
 * BS5-092 Rambutan Cookie「When your opponent's Cookie attacks, <return 3
 * non-Cookie cards from your trash to your deck and shuffle it.> Select up to
 * 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack
 * damage.」的對手指攻回應技能回歸。
 */
const rambutanSkill = {
  trigger: 'opponent-attack' as const,
  oncePerTurn: true,
  yourTurn: false,
  restSource: false,
  cost: {
    energy: {},
    discardHand: 0,
    trashToDeck: { count: 3, nonCookieOnly: true },
  },
  text: 'When your opponent attacks, return 3 non-Cookie trash cards to deck.',
  effects: [
    {
      kind: 'modify-attack' as const,
      amount: -1,
      duration: 'this-turn' as const,
      target: { side: 'opponent' as const, min: 0, max: 1 },
    },
  ],
}

const withRambutanDefender = (): GameState => {
  const state = createBattleState()
  const defender: CookieCard = {
    ...state.players['player-one'].battleArea[0].card,
    id: 'BS5-092',
    skill: rambutanSkill,
  }
  state.players['player-one'].battleArea[0] = {
    ...state.players['player-one'].battleArea[0],
    card: defender,
  }
  return state
}

describe('BS5-092 opponent-attack response skill', () => {
  it('builds positive and negative Browser fixtures from the same rule candidates', () => {
    const positive = createCardCheckDemoState('BS5-092')
    expect(getAttackResponseSkillCandidates(positive, 'player-one')).toHaveLength(1)
    const source = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS5-092',
    )
    expect(source?.card.skill?.cost.trashToDeck).toBeDefined()
    expect(
      getTrashToDeckCostCandidates(
        source!.card.skill!.cost,
        positive.players['player-one'].discardPile,
      ),
    ).toHaveLength(6)

    const negative = createCardNegativeDemoState('BS5-092')
    expect(getAttackResponseSkillCandidates(negative, 'player-one')).toEqual([])
  })

  it('builds a three-cookie positive fixture and insufficient-cost negative fixture for BS5-093', () => {
    const positive = createCardCheckDemoState('BS5-093')
    const source = positive.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS5-093',
    )
    expect(source?.card.skill?.cost.trashToDeck).toMatchObject({
      count: 3,
      cookieOnly: true,
      energyColor: 'purple',
    })
    expect(
      getTrashToDeckCostCandidates(
        source!.card.skill!.cost,
        positive.players['player-one'].discardPile,
      ),
    ).toHaveLength(4)

    const negative = createCardNegativeDemoState('BS5-093')
    const negativeSource = negative.players['player-one'].battleArea.find(
      (entry) => entry.card.id === 'BS5-093',
    )
    expect(
      getTrashToDeckCostCandidates(
        negativeSource!.card.skill!.cost,
        negative.players['player-one'].discardPile,
      ).length,
    ).toBeLessThan(3)
  })

  it('pays 3 non-Cookie trash cards and applies -1 attack to the attacker', () => {
    let state = withRambutanDefender()
    state.players['player-one'].discardPile = [
      item('p1-trash-a'),
      item('p1-trash-b'),
      item('p1-trash-c'),
      cookie('p1-trash-cookie'),
    ]
    state = declareAttack(state)

    expect(state.pendingBattle?.stage).toBe('trap')
    expect(getAttackResponseSkillCandidates(state, 'player-one')).toHaveLength(1)

    state = playAttackResponseSkill(state, 'player-one', {
      sourceInstanceId: 'defender',
      discardHandIds: [],
      trashToDeckIds: ['p1-trash-a', 'p1-trash-b', 'p1-trash-c'],
    })

    // 代價已付：3 張非 Cookie 洗回牌庫（牌庫 2+3=5），Cookie 留在棄牌區。
    expect(state.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual([
      'p1-trash-cookie',
    ])
    expect(state.players['player-one'].deck).toHaveLength(5)
    expect(state.skillUsesThisTurn).toContain('defender:battle:1')
    // 效果進入待結算佇列，陷阱視窗仍開啟（stage 仍是 trap）。
    expect(state.pendingAbilityEffect?.effects[0]).toMatchObject({
      kind: 'modify-attack',
      amount: -1,
    })
    expect(state.pendingBattle?.stage).toBe('trap')

    // 防守方選攻擊者作為 -1 攻擊目標。
    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['attacker'],
    })
    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -1 }),
    )

    // 關閉陷阱視窗後傷害重算：3 - 1 = 2。
    state = skipTrap(state, 'player-one')
    expect(state.pendingBattle?.stage).toBe('damage')
    expect(state.pendingBattle?.remainingDamage).toBe(2)

    // Once per turn：同一回合內不能再宣告。
    expect(getAttackResponseSkillCandidates(state, 'player-one')).toEqual([])
  })

  it('hides the response when the trash cannot pay the cost', () => {
    const state = withRambutanDefender()
    state.players['player-one'].discardPile = [
      item('p1-trash-a'),
      item('p1-trash-b'),
      cookie('p1-trash-cookie'),
    ]
    expect(getAttackResponseSkillCandidates(state, 'player-one')).toEqual([])
  })

  it('rejects non-candidate trash cards and wrong card counts', () => {
    let state = withRambutanDefender()
    state.players['player-one'].discardPile = [
      item('p1-trash-a'),
      item('p1-trash-b'),
      item('p1-trash-c'),
    ]
    state = declareAttack(state)

    expect(() =>
      playAttackResponseSkill(state, 'player-one', {
        sourceInstanceId: 'defender',
        discardHandIds: [],
        trashToDeckIds: ['p1-trash-a', 'p1-trash-b', 'missing'],
      }),
    ).toThrow('棄牌區卡牌不符合洗回牌庫代價條件。')

    expect(() =>
      playAttackResponseSkill(state, 'player-one', {
        sourceInstanceId: 'defender',
        discardHandIds: [],
        trashToDeckIds: ['p1-trash-a'],
      }),
    ).toThrow('必須選擇 3 張棄牌區卡牌作為技能代價。')
  })

  it('keeps the BS5-081 prevent-knockout path with a discard cost', () => {
    let state = withRambutanDefender()
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      card: {
        ...state.players['player-one'].battleArea[0].card,
        id: 'BS5-081',
        skill: {
          trigger: 'opponent-attack',
          oncePerTurn: true,
          yourTurn: false,
          restSource: false,
          cost: { energy: {}, discardHand: 4 },
          text: 'When your opponent attacks, discard 4 cards.',
          effects: [
            {
              kind: 'prevent-knockout',
              target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            },
          ],
        },
      },
    }
    state.players['player-one'].hand = [
      item('p1-hand-1'),
      item('p1-hand-2'),
      item('p1-hand-3'),
      item('p1-hand-4'),
    ]
    state = declareAttack(state)

    state = playAttackResponseSkill(state, 'player-one', {
      sourceInstanceId: 'defender',
      discardHandIds: ['p1-hand-1', 'p1-hand-2', 'p1-hand-3', 'p1-hand-4'],
      trashToDeckIds: [],
    })

    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.pendingBattle?.preventKnockoutTargetIds).toContain('defender')
    expect(state.players['player-one'].hand).toEqual([])
    expect(state.players['player-one'].discardPile).toHaveLength(4)
    expect(state.skillUsesThisTurn).toContain('defender:battle:1')
  })
})
