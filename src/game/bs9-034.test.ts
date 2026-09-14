import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import type { CookieCard } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-034-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

describe('BS9-034 Fortune Teller Cookie candidate', () => {
  it('converts the printed On Play payment and opponent HP reorder', () => {
    expect(candidate('BS9-034')).toMatchObject({
      id: 'BS9-034',
      name: 'Fortune Teller Cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackEnergyCost: { yellow: 1 },
      skill: {
        trigger: 'on-play',
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        effects: [{
          kind: 'reorder-hp',
          target: { side: 'opponent', min: 0, max: 1 },
        }],
      },
    })
  })

  it('requires an opponent target and a complete unique HP permutation', () => {
    const card = candidate('BS9-034') as CookieCard
    const effect = card.skill!.effects[0]!
    const base = createCardCheckDemoState('BS9-033')
    const opponentTarget = base.players['player-two'].battleArea[0]!
    const initial = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: base.players['player-one'].battleArea.map((entry, index) =>
            index === 0 ? { ...entry, card } : entry,
          ),
        },
      },
      pendingAbilityEffect: {
        playerId: 'player-one' as const,
        sourcePlayerId: 'player-one' as const,
        sourceInstanceId: card.instanceId,
        sourceCardName: card.name,
        sourceKind: 'skill' as const,
        effects: [effect],
        effectIndex: 0,
      },
    }
    expect(() => applyGameCommand(initial, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [base.players['player-one'].battleArea[0]!.card.instanceId],
    })).toThrow()

    const opened = applyGameCommand(initial, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [opponentTarget.card.instanceId],
    })
    expect(opened.pendingAbilityEffect?.pendingReorderHp).toEqual({
      targetPlayerId: 'player-two',
      targetInstanceId: opponentTarget.card.instanceId,
    })
    const originalIds = opponentTarget.hpCards.map((hp) => hp.instanceId)
    expect(() => applyGameCommand(opened, {
      kind: 'resolve-reorder-hp',
      playerId: 'player-one',
      orderedCardIds: originalIds.slice(1),
    })).toThrow('HP 卡重排結果不合法')
    const reversed = [...originalIds].reverse()
    const resolved = applyGameCommand(opened, {
      kind: 'resolve-reorder-hp',
      playerId: 'player-one',
      orderedCardIds: reversed,
    })
    expect(resolved.players['player-two'].battleArea[0]!.hpCards.map(
      (hp) => hp.instanceId,
    )).toEqual(reversed)
    expect(resolved.commandLog?.at(-1)).toMatchObject({
      commandKind: 'resolve-reorder-hp',
      card: { id: 'BS9-034' },
    })
  })

  it('pays exactly one yellow support before the On Play target and keeps the cost when selecting zero', () => {
    const state = createCardCheckDemoState('BS9-034')
    const source = state.players['player-one'].hand.find((card) => card.id === 'BS9-034')!
    const payment = state.players['player-one'].supportArea[0]!.card
    const deployed = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: source.instanceId,
    })
    expect(() => applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })).toThrow('技能支付無效')

    const started = applyGameCommand(deployed, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: source.instanceId,
      trigger: 'on-play',
      paymentIds: [payment.instanceId],
    })
    expect(started.players['player-one'].supportArea[0]!.rested).toBe(true)
    const skippedTarget = applyGameCommand(started, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(skippedTarget.pendingAbilityEffect).toBeUndefined()
    expect(skippedTarget.players['player-one'].supportArea[0]!.rested).toBe(true)
  })
})
