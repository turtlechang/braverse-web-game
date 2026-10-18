import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { commandFromLogEntry } from './replay'
import { createSt8020PreviewState } from './st8-020-demo'
import type { GameCard, GameState, PlayerId } from './types'

const owner = 'player-one' as const
const opponent = 'player-two' as const

const allCards = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards]),
  ]
}

const placeStage = (state: GameState): GameState => {
  const player = state.players[owner]
  const stage = player.hand.find(card => card.id === 'ST8-020')
  const payment = player.supportArea.find(support => !support.rested && support.card.energyColor === 'green')
  if (!stage || !payment) throw Error('Original Stage and a ready green Support are required')
  return applyGameCommand(state, {
    kind: 'play-stage', playerId: owner, instanceId: stage.instanceId,
    paymentIds: [payment.card.instanceId],
  })
}

const reachTurnEnd = (state: GameState): GameState => {
  const phaseEnd = applyGameCommand(state, { kind: 'advance-phase', playerId: owner })
  return applyGameCommand(phaseEnd, { kind: 'advance-phase', playerId: owner })
}

const resolveStageCleanup = (trigger: GameState): GameState => applyGameCommand(trigger, {
  kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
})

const replay = (initial: GameState, final: GameState) => {
  let replayed = structuredClone(initial)
  for (const entry of final.commandLog ?? []) {
    replayed = applyGameCommand(replayed, commandFromLogEntry(entry))
  }
  expect(JSON.parse(JSON.stringify(replayed))).toEqual(JSON.parse(JSON.stringify(final)))
}

describe('ST8-020 physical Dark Enchantress Laboratory flow', () => {
  it('uses 60-card original decks, real card art, unique instances, and the printed two-stage flow', () => {
    const initial = createSt8020PreviewState('positive')
    const before = structuredClone(initial)
    const ids: string[] = []
    for (const playerId of [owner, opponent]) {
      const cards = allCards(initial, playerId)
      expect(cards).toHaveLength(60)
      ids.push(...cards.map(card => card.instanceId))
      const counts = new Map<string, number>()
      for (const card of cards) {
        expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
        counts.set(card.id, (counts.get(card.id) ?? 0) + 1)
      }
      expect([...counts.values()].every(count => count <= 4)).toBe(true)
      for (const cookie of initial.players[playerId].battleArea) {
        expect(cookie.hpCards).toHaveLength(cookie.card.hp)
      }
    }
    expect(new Set(ids).size).toBe(120)

    const placed = placeStage(initial)
    expect(placed.players[owner].stage?.card.id).toBe('ST8-020')
    expect(placed.players[owner].hand.some(card => card.id === 'ST8-020')).toBe(false)
    expect(placed.players[owner].supportArea.filter(support => support.rested)).toHaveLength(3)
    expect(placed.commandLog?.map(entry => entry.commandKind)).toEqual(['play-stage'])

    const trigger = reachTurnEnd(placed)
    expect(trigger.pendingAbilityEffect).toMatchObject({
      playerId: owner,
      sourceInstanceId: placed.players[owner].stage?.card.instanceId,
      sourceKind: 'stage',
      trigger: 'passive',
      effectIndex: 0,
    })
    expect(trigger.pendingAbilityEffect?.effects.map(effect => effect.kind))
      .toEqual(['stage-source-to-trash', 'set-active'])

    const afterCleanup = resolveStageCleanup(trigger)
    expect(afterCleanup.players[owner].stage).toBeNull()
    expect(afterCleanup.players[owner].discardPile.some(card => card.id === 'ST8-020')).toBe(true)
    expect(afterCleanup.pendingAbilityEffect).toMatchObject({ effectIndex: 1, sourceKind: 'stage' })
    const targets = afterCleanup.players[owner].supportArea.filter(support => support.rested)
      .slice(0, 2).map(support => support.card.instanceId)
    const final = applyGameCommand(afterCleanup, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: targets,
    })
    expect(targets).toHaveLength(2)
    expect(final.pendingAbilityEffect ?? null).toBeNull()
    expect(final.players[owner].supportArea.filter(support => !support.rested)).toHaveLength(2)
    expect(final.players[owner].stage).toBeNull()
    replay(initial, final)
    expect(initial).toEqual(before)
  })

  it('allows choosing zero ready Supports and rejects payment from a rested or wrong-colour Support', () => {
    const zeroStart = createSt8020PreviewState('single-support')
    const placed = placeStage(zeroStart)
    const trigger = reachTurnEnd(placed)
    const afterCleanup = resolveStageCleanup(trigger)
    expect(afterCleanup.players[owner].discardPile.some(card => card.id === 'ST8-020')).toBe(true)
    const final = applyGameCommand(afterCleanup, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [],
    })
    expect(final.pendingAbilityEffect ?? null).toBeNull()
    expect(final.players[owner].supportArea.every(support => support.rested)).toBe(true)
    replay(zeroStart, final)

    const noGreen = createSt8020PreviewState('no-green-payment')
    const source = noGreen.players[owner].hand.find(card => card.id === 'ST8-020')!
    const illegalPayment = noGreen.players[owner].supportArea[0]!.card.instanceId
    const before = structuredClone(noGreen)
    expect(() => applyGameCommand(noGreen, {
      kind: 'play-stage', playerId: owner, instanceId: source.instanceId,
      paymentIds: [illegalPayment],
    })).toThrow()
    expect(noGreen).toEqual(before)
  })

  it('rejects a third Support target and any opponent Support target', () => {
    const initial = createSt8020PreviewState('positive')
    const afterCleanup = resolveStageCleanup(reachTurnEnd(placeStage(initial)))
    const ownTargets = afterCleanup.players[owner].supportArea
      .filter(support => support.rested)
      .map(support => support.card.instanceId)
    const opponentTarget = afterCleanup.players[opponent].supportArea[0]?.card.instanceId
    if (ownTargets.length < 3 || !opponentTarget) throw Error('Physical Support targets are required')

    const before = structuredClone(afterCleanup)
    expect(() => applyGameCommand(afterCleanup, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: ownTargets.slice(0, 3),
    })).toThrow()
    expect(afterCleanup).toEqual(before)

    expect(() => applyGameCommand(afterCleanup, {
      kind: 'resolve-ability-effect', playerId: owner, targetIds: [opponentTarget],
    })).toThrow()
    expect(afterCleanup).toEqual(before)
  })
})
