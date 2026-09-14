import { describe, expect, it } from 'vitest'
import bs9Candidates from '../../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import {
  createBs9041AttackDemoState,
  createBs9041OwnTurnDemoState,
  parseTestStateConfig,
} from './demo'
import { applyGameCommand } from './commands'
import { getEffectTargetCandidates } from './effects'
import type { CardEffect, EffectContext, GameState } from './types'

const records = bs9Candidates.cards as unknown as OfficialCardRecord[]

const candidate = (cardNumber: string) => {
  const record = records.find((card) => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing BS9 candidate ${cardNumber}`)
  const conversion = convertOfficialCardToGameCard(record, 'bs9-041-test')
  if (conversion.status !== 'converted') throw new Error(conversion.reason)
  return conversion.gameCard
}

const battleEntry = (state: GameState, playerId: 'player-one' | 'player-two', instanceId: string) => {
  const entry = state.players[playerId].battleArea.find(
    (candidateEntry) => candidateEntry.card.instanceId === instanceId,
  )
  if (!entry) throw new Error(`Missing battle entry ${instanceId}`)
  return entry
}

const resolveAttackFlip = (state: GameState, drawCount: number): GameState => {
  let next = applyGameCommand(state, {
    kind: 'resolve-flip',
    playerId: 'player-two',
    activate: true,
    discardHandIds: [],
    targetIds: [],
  })
  next = applyGameCommand(next, {
    kind: 'resolve-draw-up-to',
    playerId: 'player-two',
    drawCount,
  })
  return next
}

describe('BS9-041 Pistachio Cookie FLIP candidate', () => {
  it('converts the base card and official variants with the printed Then condition', () => {
    for (const cardNumber of ['BS9-041', 'BS9-041@1', 'BS9-041@2']) {
      const card = candidate(cardNumber)
      expect(card.id).toBe('BS9-041')
      expect(card.name).toBe('Pistachio Cookie')
      expect(card.flip).toMatchObject({
        cost: { energy: {}, discardHand: 0 },
        effects: [
          { kind: 'draw-up-to', max: 1 },
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'activated-during-your-turn' },
          },
        ],
      })
    }
  })

  it('opens the Then target after the draw decision and resumes the original attack', () => {
    const initial = createBs9041AttackDemoState('BS9-041', true)
    const hero = battleEntry(initial, 'player-one', 'bs9-bs9-018-source')
    const attacked = battleEntry(initial, 'player-two', 'bs9-opponent-red-lv1')
    expect(hero.hpCards).toHaveLength(2)
    expect(attacked.hpCards).toHaveLength(3)

    const afterDraw = resolveAttackFlip(initial, 1)
    expect(afterDraw.pendingDrawUpTo).toBeNull()
    expect(afterDraw.pendingAbilityEffect).toMatchObject({
      playerId: 'player-two',
      sourceCardName: 'Pistachio Cookie',
      effectIndex: 0,
    })
    const pendingEffect = afterDraw.pendingAbilityEffect!
    const damage = pendingEffect.effects[0] as CardEffect
    if (damage.kind !== 'damage' || !damage.target) {
      throw new Error('BS9-041 Then should be a targeted damage effect')
    }
    const context: EffectContext = {
      sourcePlayerId: pendingEffect.sourcePlayerId,
      sourceInstanceId: pendingEffect.sourceInstanceId,
      sourceCardName: pendingEffect.sourceCardName,
    }
    expect(getEffectTargetCandidates(afterDraw, context, damage.target!).map((entry) => entry.card.instanceId)).toEqual([
      'bs9-bs9-018-source',
      'bs9-own-companion',
    ])

    const afterTarget = applyGameCommand(afterDraw, {
      kind: 'resolve-ability-effect',
      playerId: 'player-two',
      targetIds: ['bs9-bs9-018-source'],
    })
    expect(afterTarget.pendingAbilityEffect ?? null).toBeNull()
    expect(battleEntry(afterTarget, 'player-one', 'bs9-bs9-018-source').hpCards).toHaveLength(1)
    expect(afterTarget.pendingBattle?.remainingDamage).toBe(1)

    const finished = applyGameCommand(afterTarget, {
      kind: 'resolve-next-damage',
      playerId: 'player-two',
    })
    expect(finished.pendingBattle ?? null).toBeNull()
    expect(battleEntry(finished, 'player-two', 'bs9-opponent-red-lv1').hpCards).toHaveLength(2)
  })

  it('keeps the natural BS9-018 attack route as a condition-false no-op', () => {
    const initial = createBs9041AttackDemoState('BS9-041', false)
    const afterDraw = resolveAttackFlip(initial, 0)
    expect(afterDraw.pendingDrawUpTo).toBeNull()
    expect(afterDraw.pendingAbilityEffect ?? null).toBeNull()
    expect(battleEntry(afterDraw, 'player-one', 'bs9-bs9-018-source').hpCards).toHaveLength(2)

    const finished = applyGameCommand(afterDraw, {
      kind: 'resolve-next-damage',
      playerId: 'player-two',
    })
    expect(finished.pendingBattle ?? null).toBeNull()
    expect(battleEntry(finished, 'player-one', 'bs9-bs9-018-source').hpCards).toHaveLength(2)
    expect(battleEntry(finished, 'player-two', 'bs9-opponent-red-lv1').hpCards).toHaveLength(2)
  })

  it('keeps the localhost routes isolated and exposes the legal own-turn control route', () => {
    expect(parseTestStateConfig(
      '?test-state=bs9-041-attack:BS9-041:met',
      'localhost',
    )).toEqual({
      kind: 'bs9-041-attack',
      cardNumber: 'BS9-041',
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-041-attack:BS9-041@2:unmet',
      'localhost',
    )).toEqual({
      kind: 'bs9-041-attack',
      cardNumber: 'BS9-041@2',
      conditionMet: false,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-041-own-turn-negative:BS9-041@1',
      'localhost',
    )).toEqual({
      kind: 'bs9-041-own-turn',
      cardNumber: 'BS9-041@1',
      negative: true,
    })
    expect(parseTestStateConfig(
      '?test-state=bs9-041-attack:BS9-041:met',
      'braverse.example',
    )).toBeNull()

    const ownTurn = createBs9041OwnTurnDemoState('BS9-041')
    expect(ownTurn.activePlayerId).toBe('player-one')
    expect(ownTurn.players['player-one'].hand.some((card) => card.id === 'P-018')).toBe(true)
  })
})
