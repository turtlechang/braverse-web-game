import { describe, expect, it } from 'vitest'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import bs9Candidates from '../../data/candidates/official-a-game-of-truth-and-deceit-bs9.en.json'
import {
  createBs9CandidatePreviewDemoState,
  createCardCheckDemoState,
  parseTestStateConfig,
} from './demo'
import { resolveFlip, resolveNextDamage } from './battle'
import { executeCardEffect } from './effects'
import { getAttackDamageAgainst } from './effects/combat'
import { advancePhase } from './turn'
import type { EffectContext, GameState, GameCard } from './types'

const candidate = (cardNumber: string): GameCard => {
  const records = bs9Candidates.cards as unknown as OfficialCardRecord[]
  const source = records.find(
    (card) => card.cardNumber === cardNumber,
  ) ?? records.find(
    (card) => card.baseCardNumber === cardNumber,
  )
  if (!source) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(source, 'bs9-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const activateForTarget = (
  state: GameState,
  targetInstanceId: string,
): GameState => resolveFlip(state, 'player-one', {
  activate: true,
  targetIds: [targetInstanceId],
})

const finishRemainingAttackDamage = (state: GameState): GameState =>
  state.pendingBattle?.stage === 'damage'
    ? resolveNextDamage(state)
    : state

const effectDamage = (
  state: GameState,
  sourceInstanceId: string,
  targetInstanceId: string,
  amount: number,
): GameState => executeCardEffect(
  state,
  { sourcePlayerId: 'player-one', sourceInstanceId } satisfies EffectContext,
  {
    kind: 'damage',
    amount,
    target: { side: 'self', min: 1, max: 1 },
  },
  [targetInstanceId],
)

describe('BS9-001 Icicle Yeti Cookie', () => {
  it('converts base and alternate art records to an effect-damage FLIP modifier', () => {
    for (const cardNumber of ['BS9-001', 'BS9-001@1', 'BS9-001@2']) {
      const card = candidate(cardNumber)
      expect(card.flip).toMatchObject({
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'modify-damage-received',
            amount: -2,
            duration: 'this-turn',
            damageType: 'effect',
            target: { side: 'self', min: 0, max: 1 },
          },
        ],
      })
    }
  })

  it('selects at most one own Cookie and keeps the optional zero-target path legal', () => {
    const initial = createCardCheckDemoState('BS9-001')
    const ownTargets = initial.players['player-one'].battleArea.map(
      (entry) => entry.card.instanceId,
    )
    const opponentTarget = initial.players['player-two'].battleArea[0]?.card.instanceId
    const revealedSourceId = initial.pendingBattle?.revealedHpCard?.instanceId
    expect(opponentTarget).toBeDefined()
    expect(revealedSourceId).toBeDefined()
    expect(ownTargets).toHaveLength(2)
    const attackedTarget = initial.players['player-one'].battleArea[0]
    expect(attackedTarget?.card.name).toBe('Lassi Guard Kulfi')
    expect(attackedTarget?.hpCards).toHaveLength(attackedTarget.card.hp - 1)

    const selected = activateForTarget(initial, ownTargets[1])
    expect(selected.pendingBattle?.remainingDamage).toBe(1)
    expect(selected.players['player-one'].battleArea[0]?.hpCards).toHaveLength(
      attackedTarget!.hpCards.length,
    )
    expect(selected.players['player-one'].battleArea[1]?.hpCards).toHaveLength(
      initial.players['player-one'].battleArea[1]!.hpCards.length,
    )
    expect(selected.damageReceivedModifiers).toContainEqual({
      sourceInstanceId: revealedSourceId!,
      targetInstanceId: ownTargets[1],
      amount: -2,
      expiresAfterTurn: 2,
      damageType: 'effect',
      minimumDamage: undefined,
      setDamageTo: undefined,
    })

    const noTarget = resolveFlip(initial, 'player-one', {
      activate: true,
      targetIds: [],
    })
    expect(noTarget.damageReceivedModifiers).toEqual([])
    const completedNoTarget = resolveNextDamage(noTarget)
    expect(completedNoTarget.players['player-one'].battleArea[0]?.hpCards).toHaveLength(
      attackedTarget!.hpCards.length - 1,
    )
    expect(() => resolveFlip(initial, 'player-one', {
      activate: true,
      targetIds: ownTargets,
    })).toThrow()
    expect(() => resolveFlip(initial, 'player-one', {
      activate: true,
      targetIds: [opponentTarget!],
    })).toThrow()
  })

  it('reduces effect damage at the 1/2/3 boundary without reducing attack damage', () => {
    const initial = createCardCheckDemoState('BS9-001')
    const sourceId = initial.players['player-one'].battleArea[0].card.instanceId
    const targetId = initial.players['player-one'].battleArea[1].card.instanceId
    const opponentAttackerId = initial.players['player-two'].battleArea[0]?.card.instanceId
    expect(opponentAttackerId).toBeDefined()
    const baselineAttackDamage = getAttackDamageAgainst(initial, opponentAttackerId!, targetId)

    const activated = finishRemainingAttackDamage(activateForTarget(initial, targetId))
    const targetHp = activated.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === targetId,
    )!.hpCards.length
    for (const amount of [1, 2]) {
      const result = effectDamage(activated, sourceId, targetId, amount)
      expect(result.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === targetId,
      )!.hpCards.length).toBe(targetHp)
    }
    const threeDamage = effectDamage(activated, sourceId, targetId, 3)
    expect(threeDamage.players['player-one'].battleArea.find(
      (entry) => entry.card.instanceId === targetId,
    )!.hpCards.length).toBe(targetHp - 1)

    expect(getAttackDamageAgainst(activated, opponentAttackerId!, targetId)).toBe(baselineAttackDamage)
  })

  it('expires the selected Cookie modifier at the end of the current turn', () => {
    const initial = createCardCheckDemoState('BS9-001')
    const targetId = initial.players['player-one'].battleArea[1].card.instanceId
    const activated = finishRemainingAttackDamage(activateForTarget(initial, targetId))
    expect(activated.damageReceivedModifiers).toHaveLength(1)

    const nextTurn = advancePhase(advancePhase(activated))
    expect(nextTurn.turnNumber).toBe(3)
    expect(nextTurn.damageReceivedModifiers).toEqual([])
  })

  it('keeps BS9-001 in an isolated localhost candidate preview route', () => {
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-001', 'localhost'))
      .toEqual({ kind: 'bs9-candidate', cardNumber: 'BS9-001', negative: false })
    expect(parseTestStateConfig('?test-state=bs9-card-negative:BS9-001@1', 'localhost'))
      .toEqual({ kind: 'bs9-candidate', cardNumber: 'BS9-001@1', negative: true })
    expect(parseTestStateConfig('?test-state=bs9-card:BS9-001', 'braverse.example'))
      .toBeNull()
    const preview = createBs9CandidatePreviewDemoState('BS9-001')
    expect(preview.pendingBattle?.revealedHpCard?.id).toBe('BS9-001')
    expect(preview.pendingBattle?.revealedHpCard?.flip).toBeDefined()
  })
})
