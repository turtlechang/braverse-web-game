import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialTrapAbility } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { beginAttack } from './battle'
import { applyGameCommand } from './commands'
import type { CookieCard, GameCard, GameState } from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

const bs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )
  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

/** BS3-093《Convocation of Elders》：-1 攻擊，然後翻牌決定要不要再 -1。 */
const convocationCard = (instanceId: string): GameCard => {
  const trap = convertOfficialTrapAbility(bs3Card('BS3-093'))
  if (!trap) throw new Error('BS3-093 should convert to a trap ability.')
  return {
    id: 'BS3-093',
    instanceId,
    name: 'Convocation of Elders',
    type: 'trap',
    energyColor: 'blue',
    trap,
  }
}

const blueLv2Cookie = (instanceId: string): CookieCard => ({
  ...cookie(instanceId, 0, 1),
  level: 2,
  energyColor: 'blue',
})

/**
 * player-one 是防守方（陷阱擁有者），player-two 是攻擊方（attacker 攻擊 3）。
 * `deckTop` 決定翻牌是否匹配 {B} LV.2 Cookie。
 */
const createConvocationState = (deckTop: GameCard): GameState => {
  const base = createBattleState()
  const prepared: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        // 手牌只留陷阱：defender 昏厥後不要跑出補位決策干擾這裡要驗的流程。
        hand: [convocationCard('convocation')],
        deck: [deckTop, item('p1-deck-b')],
        supportArea: [
          { card: item('p1-support-a', 'blue'), rested: false },
          { card: item('p1-support-b', 'blue'), rested: false },
        ],
      },
    },
  }
  return beginAttack(prepared, 'attacker', 'defender', ['p2-support'])
}

const playConvocation = (state: GameState): GameState =>
  applyGameCommand(state, {
    kind: 'play-trap',
    playerId: 'player-one',
    trapInstanceId: 'convocation',
    paymentIds: ['p1-support-a'],
    targetIds: ['attacker'],
  })

const defenderHp = (state: GameState) =>
  state.players['player-one'].battleArea[0]?.hpCards.length ?? 0

/**
 * 陷阱裡的 reveal-top-deck（BS3-093）發生在傷害結算「之前」，跟 BS3-076／080
 * 那種攻擊後的 reveal 不同：確認翻牌不能順手把戰鬥收掉，否則這次攻擊的傷害
 * 會整個消失，等於一張陷阱無效化任何一次攻擊。
 */
describe('BS3-093 陷阱內的 reveal-top-deck 不會吃掉攻擊傷害', () => {
  it('未匹配：確認翻牌後戰鬥仍停在傷害階段，傷害照常結算', () => {
    let state = createConvocationState(item('p1-deck-a'))
    state = playConvocation(state)

    expect(state.pendingRevealTopDeck?.matched).toBe(false)
    // 陷阱視窗裡的翻牌：欠的是「推進到傷害階段」，不是「收尾」。
    expect(state.pendingRevealTopDeck?.battleContinuation).toBe('after-trap')
    expect(state.pendingBattle?.stage).toBe('trap')

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-one',
    })

    expect(state.pendingRevealTopDeck).toBeNull()
    expect(state.pendingBattle?.stage).toBe('damage')
    expect(defenderHp(state)).toBe(3)

    state = applyGameCommand(state, {
      kind: 'resolve-battle',
      playerId: 'player-two',
    })

    // 攻擊 3 扣掉陷阱的 -1 ＝ 2 點傷害。
    expect(state.pendingBattle).toBeNull()
    expect(defenderHp(state)).toBe(1)
  })

  it('匹配：巢狀效果選完目標後戰鬥仍在，傷害再減 1', () => {
    let state = createConvocationState(blueLv2Cookie('blue-lv2'))
    state = playConvocation(state)

    expect(state.pendingRevealTopDeck?.matched).toBe(true)

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-one',
    })

    expect(state.pendingAbilityEffect).toBeDefined()
    expect(state.pendingAbilityEffect?.battleContinuation).toBe('after-trap')

    state = applyGameCommand(state, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['attacker'],
    })

    expect(state.pendingAbilityEffect).toBeUndefined()
    expect(state.pendingBattle?.stage).toBe('damage')

    state = applyGameCommand(state, {
      kind: 'resolve-battle',
      playerId: 'player-two',
    })

    // 攻擊 3 扣掉兩次 -1 ＝ 1 點傷害。
    expect(state.pendingBattle).toBeNull()
    expect(defenderHp(state)).toBe(2)
  })
})

/**
 * 反向情境：BS3-076／080 的攻擊後 reveal 確實是 finishBattle 延後下來的，
 * 翻牌結算完必須把戰鬥收掉；而且延遲陷阱在延後前就已經跑過一次，第二次
 * finishBattle 不能讓它再結算一遍。
 */
describe('攻擊後的 reveal-top-deck 由翻牌收尾，且延遲陷阱只結算一次', () => {
  const createDelayedTrapState = (): GameState => {
    const base = createBattleState()
    const attacker = base.players['player-two'].battleArea[0]
    const delayedTrapCard: GameCard = {
      id: 'TEST-DELAY',
      instanceId: 'delay-trap',
      name: '測試用延遲陷阱',
      type: 'trap',
      energyColor: 'red',
      trap: {
        text: '本次戰鬥有己方紅色餅乾昏厥時，抽 1 張。',
        cost: { energy: {}, discardHand: 0 },
        condition: {
          kind: 'friendly-color-fainted-this-battle',
          color: 'red',
        },
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const prepared: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          // 只留陷阱，昏厥後不會有補位決策。
          hand: [delayedTrapCard],
          deck: [item('p1-deck-a'), item('p1-deck-b'), item('p1-deck-c')],
          battleArea: [
            {
              ...base.players['player-one'].battleArea[0],
              // 只剩 1 張 HP，attacker 攻擊 3 必定昏厥，觸發延遲陷阱。
              hpCards: [item('defender-hp-a')],
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          deck: [item('p2-deck-a')],
          battleArea: [
            {
              ...attacker,
              card: {
                ...attacker.card,
                attackEffects: [
                  {
                    kind: 'optional-cost-attack',
                    cost: { energy: {} },
                    effects: [
                      {
                        kind: 'reveal-top-deck',
                        match: { type: 'cookie', energyColor: 'blue', level: 2 },
                        effects: [{ kind: 'draw', amount: 1 }],
                      },
                    ],
                    effectText: '翻開牌庫頂 1 張。',
                  },
                ],
              },
            },
          ],
        },
      },
    }
    return beginAttack(prepared, 'attacker', 'defender', ['p2-support'])
  }

  it('翻牌確認後才收尾，延遲陷阱不會抽第二張', () => {
    let state = createDelayedTrapState()
    state = applyGameCommand(state, {
      kind: 'play-trap',
      playerId: 'player-one',
      trapInstanceId: 'delay-trap',
      paymentIds: [],
      targetIds: [],
    })
    expect(state.pendingBattle?.delayedTrap).toBeDefined()

    // 自動結算會一路跑到攻擊後效果並支付可選代價，然後停在等待玩家確認翻牌。
    state = applyGameCommand(state, {
      kind: 'resolve-battle',
      playerId: 'player-two',
    })

    // 延遲陷阱在 finishBattle 延後時就已經抽過一次。
    expect(state.pendingRevealTopDeck?.battleContinuation).toBe('finish')
    expect(state.pendingBattle).toBeTruthy()
    expect(state.players['player-one'].hand).toHaveLength(1)

    state = applyGameCommand(state, {
      kind: 'resolve-reveal-top-deck',
      playerId: 'player-two',
    })

    // 第二次 finishBattle 只負責收尾，延遲陷阱不能再抽一張。
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].hand).toHaveLength(1)
  })
})
