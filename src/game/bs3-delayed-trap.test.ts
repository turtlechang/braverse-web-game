import { describe, expect, it } from 'vitest'
import officialBS3Inventory from '../../data/candidates/official-age-of-heroes-and-kingdoms-bs3.en.json'
import { convertOfficialTrapAbility } from '../cards/official-effect-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { beginAttack } from './battle'
import { applyGameCommand } from './commands'
import { handleAiPendingDecision } from './ai/pending-handler'
import type { CookieCard, GameCard, GameState, TrapAbility } from './types'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

const bs3Card = (cardNumber: string) => {
  const card = (officialBS3Inventory.cards as OfficialCardRecord[]).find(
    (candidate) => candidate.cardNumber === cardNumber,
  )
  if (!card) throw new Error(`Missing BS3 inventory card ${cardNumber}`)
  return card
}

const colosseum = (): TrapAbility => {
  const trap = convertOfficialTrapAbility(bs3Card('BS3-046'))
  if (!trap) throw new Error('BS3-046 should convert to a trap ability.')
  return trap
}

const yellowCookie = (
  instanceId: string,
  level: number,
  hp = 2,
): CookieCard => ({
  ...cookie(instanceId, 1, hp),
  level,
  energyColor: 'yellow',
})

const trapCard = (instanceId: string): GameCard => ({
  id: 'BS3-046',
  instanceId,
  name: 'Golden Cheese Colosseum',
  type: 'trap',
  energyColor: 'yellow',
  trap: colosseum(),
})

/**
 * player-one 是防守方（陷阱擁有者），player-two 是攻擊方。
 * 防守方的 `defender` 換成 {Y} LV.2 且只剩 1 HP，攻擊必定造成昏厥。
 */
const createColosseumState = (
  options: { defenderLevel?: number; defenderColor?: 'yellow' | 'blue' } = {},
): GameState => {
  const base = createBattleState()
  const defender: CookieCard = {
    ...yellowCookie('defender', options.defenderLevel ?? 2, 1),
    energyColor: options.defenderColor ?? 'yellow',
  }
  const prepared: GameState = {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        hand: [
          trapCard('colosseum'),
          yellowCookie('hand-cost-lv1', 1),
          yellowCookie('break-lv1', 1),
        ],
        battleArea: [
          {
            card: defender,
            hpCards: [item('defender-hp-a')],
            rested: false,
            battleEntryId: 'defender:battle:1',
          },
        ],
        supportArea: [
          { card: item('p1-support-a', 'yellow'), rested: false },
          { card: item('p1-support-b', 'yellow'), rested: false },
        ],
        breakArea: [yellowCookie('break-lv1', 1)],
      },
    },
  }

  // 進入陷阱階段才能發動；attacker 攻擊 3 對只剩 1 HP 的 defender 必定造成昏厥。
  return beginAttack(prepared, 'attacker', 'defender', ['p2-support'])
}

const playColosseum = (state: GameState): GameState =>
  applyGameCommand(state, {
    kind: 'play-trap',
    playerId: 'player-one',
    trapInstanceId: 'colosseum',
    paymentIds: ['p1-support-a', 'p1-support-b'],
    targetIds: [],
    handToBreakIds: ['hand-cost-lv1'],
  })

const runBattleToEnd = (state: GameState): GameState =>
  applyGameCommand(state, {
    kind: 'resolve-battle',
    playerId: 'player-two',
  })

describe('BS3-046 Golden Cheese Colosseum', () => {
  it('converts into a level-gated delayed trap with a hand-to-break cost', () => {
    const trap = colosseum()
    expect(trap.cost.energy).toEqual({ yellow: 2 })
    expect(trap.cost.handToBreakArea).toEqual({
      count: 1,
      energyColor: 'yellow',
    })
    expect(trap.condition).toEqual({
      kind: 'friendly-color-fainted-this-battle',
      color: 'yellow',
      minLevel: 2,
    })
    expect(trap.effects).toEqual([
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
        energyColor: 'yellow',
      },
    ])
  })

  it('pays the cost by putting a hand Cookie into its own break area', () => {
    const state = playColosseum(createColosseumState())
    const player = state.players['player-one']

    expect(player.hand.map((card) => card.instanceId)).toEqual(['break-lv1'])
    expect(player.breakArea.map((card) => card.instanceId)).toEqual([
      'break-lv1',
      'hand-cost-lv1',
    ])
    // 陷阱卡本身照常進棄牌區，代價卡不會跟著進去。
    expect(player.discardPile.map((card) => card.instanceId)).toEqual([
      'colosseum',
    ])
  })

  it('rejects paying with a hand Cookie of the wrong colour', () => {
    const base = createColosseumState()
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [trapCard('colosseum'), cookie('blue-hand')],
        },
      },
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'play-trap',
        playerId: 'player-one',
        trapInstanceId: 'colosseum',
        paymentIds: ['p1-support-a', 'p1-support-b'],
        targetIds: [],
        handToBreakIds: ['blue-hand'],
      }),
    ).toThrowError()
  })

  it('rejects playing the trap without paying the cost', () => {
    expect(() =>
      applyGameCommand(createColosseumState(), {
        kind: 'play-trap',
        playerId: 'player-one',
        trapInstanceId: 'colosseum',
        paymentIds: ['p1-support-a', 'p1-support-b'],
        targetIds: [],
      }),
    ).toThrowError()
  })

  it('hands the break-area play to the pending ability queue after a LV.2 faint', () => {
    const finished = runBattleToEnd(playColosseum(createColosseumState()))

    expect(finished.pendingBattle).toBeNull()
    expect(finished.pendingAbilityEffect?.sourceKind).toBe('trap')
    expect(finished.pendingAbilityEffect?.playerId).toBe('player-one')
    expect(finished.pendingAbilityEffect?.effects).toEqual([
      {
        kind: 'break-to-battle',
        amount: 1,
        exactLevel: 1,
        energyColor: 'yellow',
      },
    ])
  })

  it('does not trigger when only a LV.1 Cookie faints', () => {
    const finished = runBattleToEnd(
      playColosseum(createColosseumState({ defenderLevel: 1 })),
    )

    expect(finished.pendingAbilityEffect).toBeUndefined()
  })

  it('does not trigger when the fainted Cookie is another colour', () => {
    const finished = runBattleToEnd(
      playColosseum(createColosseumState({ defenderColor: 'blue' })),
    )

    expect(finished.pendingAbilityEffect).toBeUndefined()
  })

  it('plays the chosen LV.1 Cookie back from the break area', () => {
    const finished = runBattleToEnd(playColosseum(createColosseumState()))

    const resolved = applyGameCommand(finished, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: ['break-lv1'],
    })

    expect(
      resolved.players['player-one'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    ).toContain('break-lv1')
    expect(resolved.pendingAbilityEffect).toBeUndefined()
  })

  it('lets the AI resolve the trap-sourced pending ability instead of stalling', () => {
    const finished = runBattleToEnd(playColosseum(createColosseumState()))

    const decision = handleAiPendingDecision(finished, 'player-one')
    expect(decision).not.toBeNull()
    expect(decision!.state.pendingAbilityEffect).toBeUndefined()
    expect(
      decision!.state.players['player-one'].battleArea.map(
        (entry) => entry.card.instanceId,
      ),
    ).toContain('break-lv1')
  })
})
