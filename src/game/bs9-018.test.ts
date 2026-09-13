import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  createBs9018KumihoAttackDemoState,
  createBs9018ProtectionDemoState,
  createBs9CandidatePreviewDemoState,
  createCardCheckDemoState,
  createCardNegativeDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { getAttackDamageAgainst, getEffectDamageAmount } from './effects/combat'
import { getCookieEffectiveHp } from './helpers'
import type { EffectContext, GameCard, GameState } from './types'

const candidate = (cardNumber: string): GameCard => {
  const records = bs9Candidates.cards as unknown as OfficialCardRecord[]
  const source = records.find((card) => card.cardNumber === cardNumber)
  if (!source) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(source, 'bs9-018-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const cookie = (state: GameState, instanceId: string) =>
  Object.values(state.players)
    .flatMap((player) => player.battleArea)
    .find((entry) => entry.card.instanceId === instanceId)

const resolveProtectionSequence = (initial: GameState): GameState => {
  let state = initial
  for (let step = 0; state.pendingBattle && step < 8; step += 1) {
    if (state.pendingBattle.stage !== 'damage') {
      throw new Error(`BS9-018 fixture stopped at ${state.pendingBattle.stage}`)
    }
    state = applyGameCommand(state, {
      kind: 'resolve-next-damage',
      playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId,
    })
  }
  return state
}

const resolveKumihoSequence = (initial: GameState): GameState => {
  let state = initial
  for (let step = 0; state.pendingBattle && step < 8; step += 1) {
    const playerId =
      state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId
    if (state.pendingBattle.stage === 'flip') {
      const targetId = state.pendingBattle.attackerInstanceId
      const discard = state.players[playerId].hand[0]
      if (!discard) throw new Error('Kumiho fixture has no discard payment')
      state = applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId,
        activate: true,
        discardHandIds: [discard.instanceId],
        targetIds: [targetId],
      })
      continue
    }
    state = applyGameCommand(state, {
      kind: 'resolve-next-damage',
      playerId,
    })
  }
  return state
}

describe('BS9-018 Hero Cookie', () => {
  it('converts the printed Your Turn owner-wide prevention effect', () => {
    expect(candidate('BS9-018')).toMatchObject({
      name: 'Hero Cookie',
      skill: {
        trigger: 'passive',
        yourTurn: true,
        effects: [{ kind: 'prevent-opponent-damage' }],
      },
    })
  })

  it('prevents opponent attack/effect damage to every own Cookie only on the owner turn', () => {
    const state = createCardCheckDemoState('BS9-018')
    const ownCookies = state.players['player-one'].battleArea
    const hero = ownCookies.find((entry) => entry.card.id === 'BS9-018')!
    const opponent = state.players['player-two'].battleArea[0]
    const opponentContext: EffectContext = {
      sourcePlayerId: 'player-two',
      sourceInstanceId: opponent.card.instanceId,
    }

    for (const target of ownCookies) {
      expect(getAttackDamageAgainst(state, opponent.card.instanceId, target.card.instanceId)).toBe(0)
      expect(getEffectDamageAmount(state, opponentContext, 2, target.card.instanceId)).toBe(0)
    }

    // The wording protects against the opponent only: an own effect must still
    // be able to damage an own Cookie when another card supplies that effect.
    const ownContext: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: hero.card.instanceId,
    }
    expect(getEffectDamageAmount(state, ownContext, 2, hero.card.instanceId)).toBe(2)
    expect(getEffectDamageAmount(state, ownContext, 2, ownCookies[1].card.instanceId)).toBe(2)

    const opponentTurn = { ...state, activePlayerId: 'player-two' as const }
    for (const target of ownCookies) {
      expect(getAttackDamageAgainst(opponentTurn, opponent.card.instanceId, target.card.instanceId)).toBeGreaterThan(0)
      expect(getEffectDamageAmount(opponentTurn, opponentContext, 2, target.card.instanceId)).toBe(2)
    }

    const heroLeftBattle = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: state.players['player-one'].battleArea.filter(
            (entry) => entry.card.instanceId !== hero.card.instanceId,
          ),
        },
      },
    }
    expect(getEffectDamageAmount(heroLeftBattle, opponentContext, 2, ownCookies[1].card.instanceId)).toBe(2)
  })

  it('resolves a real-source two-target damage sequence with positive and negative A/B routes', () => {
    const positive = createBs9018ProtectionDemoState('BS9-018')
    const positiveBefore = positive.players['player-one'].battleArea.map<[string, number]>((entry) => [
      entry.card.instanceId,
      entry.hpCards.length,
    ])
    const positiveAfter = resolveProtectionSequence(positive)
    expect(positiveAfter.pendingBattle).toBeNull()
    for (const [instanceId, hp] of positiveBefore) {
      expect(cookie(positiveAfter, instanceId)?.hpCards.length).toBe(hp)
    }

    const negative = createBs9018ProtectionDemoState('BS9-018', true)
    const negativeBefore = negative.players['player-one'].battleArea.map<[string, number]>((entry) => [
      entry.card.instanceId,
      entry.hpCards.length,
    ])
    const negativeAfter = resolveProtectionSequence(negative)
    expect(negativeAfter.pendingBattle).toBeNull()
    for (const [instanceId, hp] of negativeBefore) {
      expect(cookie(negativeAfter, instanceId)?.hpCards.length).toBe(hp - 1)
    }
  })

  it.each([
    ['BS1-007', false, 'BS9-018', 3, 2],
    ['BS1-007', true, 'BS8-014', 3, 1],
    ['BS8-007', false, 'BS9-018', 4, 3],
    ['BS8-007', true, 'BS8-014', 4, 2],
  ] as const)(
    'opens a real %s attack with Kumiho and protects the attacker on the positive route',
    (targetCardNumber, negative, attackerId, targetHpAfterReveal, targetHpAfterBattle) => {
      const state = createBs9018KumihoAttackDemoState(
        'BS9-018',
        negative,
        targetCardNumber,
      )
      const attacker = state.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId ===
          (negative ? 'bs9-own-companion' : 'bs9-bs9-018-source'),
      )
      const target = state.players['player-two'].battleArea.find(
        (entry) => entry.card.id === targetCardNumber,
      )
      expect(attacker?.card.id).toBe(attackerId)
      expect(state.pendingBattle).toMatchObject({
        stage: 'flip',
        attackerInstanceId: attacker?.card.instanceId,
        targetInstanceId: target?.card.instanceId,
        revealedHpCard: expect.objectContaining({ id: 'BS1-002', name: 'Kumiho Cookie' }),
      })
      expect(target).toBeDefined()
      expect(target?.hpCards).toHaveLength(targetHpAfterReveal)

      const beforeAttackerHp = attacker ? getCookieEffectiveHp(attacker) : -1
      const resolved = resolveKumihoSequence(state)
      expect(resolved.pendingBattle).toBeNull()
      const resolvedAttacker = resolved.players['player-one'].battleArea.find(
        (entry) => entry.card.instanceId === attacker?.card.instanceId,
      )
      const resolvedTarget = resolved.players['player-two'].battleArea.find(
        (entry) => entry.card.id === targetCardNumber,
      )
      expect(resolvedTarget?.hpCards).toHaveLength(targetHpAfterBattle)
      expect(getCookieEffectiveHp(resolvedAttacker!)).toBe(
        negative ? beforeAttackerHp - 1 : beforeAttackerHp,
      )
      expect(resolved.players['player-two'].hand).toHaveLength(0)
      expect(resolved.players['player-two'].discardPile).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'BS8-021', instanceId: 'bs9-018-kumiho-discard-cost' }),
          expect.objectContaining({ id: 'BS1-002', instanceId: 'bs9-018-kumiho-hp' }),
        ]),
      )

      const entries = resolved.commandLog ?? []
      expect(entries.map((entry) => entry.commandKind)).toEqual(
        expect.arrayContaining(['declare-attack', 'skip-trap', 'resolve-next-damage', 'resolve-flip']),
      )
      expect(entries.find((entry) => entry.commandKind === 'resolve-next-damage')?.card?.id).toBe('BS1-002')
      expect(entries.find((entry) => entry.commandKind === 'resolve-flip')?.card?.id).toBe('BS1-002')
    },
  )

  it('routes card and card-negative localhost URLs to the isolated Kumiho witness', () => {
    expect(parseTestStateConfig('?test-state=card:BS9-018', 'localhost')).toEqual({
      kind: 'bs9-018-kumiho',
      cardNumber: 'BS9-018',
      negative: false,
      targetCardNumber: 'BS1-007',
    })
    expect(parseTestStateConfig(
      '?test-state=card-negative:BS9-018&bs9-target=BS8-007',
      'localhost',
    )).toEqual({
      kind: 'bs9-018-kumiho',
      cardNumber: 'BS9-018',
      negative: true,
      targetCardNumber: 'BS8-007',
    })
    expect(parseTestStateConfig('?test-state=card:BS9-018', 'braverse.example')).toBeNull()

    const positive = createCardCheckDemoState('BS9-018')
    const negative = createCardNegativeDemoState('BS9-018')
    expect(positive.players['player-one'].battleArea.map((entry) => entry.card.id)).toEqual(
      expect.arrayContaining(['BS9-018', 'BS8-014']),
    )
    expect(negative.players['player-one'].battleArea.map((entry) => entry.card.id)).toEqual(['BS8-014'])
    expect(negative.players['player-one'].hand).toEqual(
      expect.arrayContaining([expect.objectContaining({ instanceId: 'bs9-018-kumiho-negative-hand', id: 'BS9-018' })]),
    )
  })

  it('keeps the protection witness localhost-only and candidate-isolated', () => {
    expect(parseTestStateConfig('?test-state=bs9-protection:BS9-018', 'localhost')).toEqual({
      kind: 'bs9-protection',
      cardNumber: 'BS9-018',
      negative: false,
    })
    expect(parseTestStateConfig('?test-state=bs9-protection-negative:BS9-018', 'localhost')).toEqual({
      kind: 'bs9-protection',
      cardNumber: 'BS9-018',
      negative: true,
    })
    expect(parseTestStateConfig('?test-state=bs9-protection:BS9-018', 'braverse.example')).toBeNull()
    expect(createBs9CandidatePreviewDemoState('BS9-018').players['player-one'].battleArea)
      .toEqual(expect.arrayContaining([expect.objectContaining({ card: expect.objectContaining({ id: 'BS9-018' }) })]))
  })
})
