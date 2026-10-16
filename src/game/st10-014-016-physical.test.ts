import { describe, expect, it } from 'vitest'
import { canPlayItem } from './card-abilities'
import { applyGameCommand } from './commands'
import { isEffectConditionMet } from './effects'
import { parseTestStateConfig } from './demo'
import { createSt1014To016ItemPreviewState, type St10ItemCardNumber } from './st10-014-016-demo'
import type { GameCard, GameState, PlayerId } from './types'

const one = 'player-one' as const
const two = 'player-two' as const

const physicalCards = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.discardPile,
    ...player.breakArea,
    ...player.supportArea.map(entry => entry.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
  ]
}

const assertPhysicalDecks = (state: GameState) => {
  const allIds = new Set<string>()
  for (const playerId of [one, two]) {
    const cards = physicalCards(state, playerId)
    expect(cards).toHaveLength(60)
    expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
    const copyCounts = new Map<string, number>()
    for (const card of cards) {
      expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
      expect(allIds.has(card.instanceId)).toBe(false)
      allIds.add(card.instanceId)
      copyCounts.set(card.id, (copyCounts.get(card.id) ?? 0) + 1)
    }
    expect([...copyCounts.values()].every(count => count <= 4)).toBe(true)
  }
  expect(allIds.size).toBe(120)
}

const playItem = (
  state: GameState,
  cardNumber: St10ItemCardNumber,
  targetIds: string[],
) => {
  const source = state.players[one].hand.find(card => card.id === cardNumber)
  if (!source) throw new Error(`Missing ${cardNumber} in the physical Item hand`)
  const supportCount = cardNumber === 'ST10-015' ? 2 : 1
  const paymentIds = state.players[one].supportArea
    .filter(entry => !entry.rested && entry.card.energyColor === 'purple')
    .slice(0, supportCount)
    .map(entry => entry.card.instanceId)
  if (paymentIds.length !== supportCount) throw new Error(`${cardNumber} lacks its printed purple payment`)
  const command = {
    kind: 'play-item' as const,
    playerId: one,
    instanceId: source.instanceId,
    paymentIds,
    effectTargets: [targetIds],
    ...(cardNumber === 'ST10-014'
      ? { trashBattleCookieIds: [state.players[one].battleArea[1]!.card.instanceId] }
      : {}),
  }
  return applyGameCommand(state, command)
}

const settleDamage = (initial: GameState): GameState => {
  let state = initial
  for (let index = 0; index < 20 && state.pendingBattle?.stage === 'damage'; index += 1) {
    state = applyGameCommand(state, {
      kind: 'resolve-next-damage',
      playerId: state.pendingBattle.damagePlayerId ?? state.pendingBattle.defenderPlayerId,
    })
  }
  return state
}

describe('ST10-014 to ST10-016 original physical Item routes', () => {
  it.each([
    ['ST10-014', 'positive'], ['ST10-014', 'no-material'],
    ['ST10-015', 'battle-witness'], ['ST10-015', 'trash-witness'], ['ST10-015', 'no-witness'],
    ['ST10-016', 'fifteen-trash'], ['ST10-016', 'fourteen-trash'], ['ST10-016', 'thirteen-trash'],
  ] as const)('%s %s route is local-only and uses a physical fixture', (cardNumber, scenario) => {
    const route = `?test-state=st10-item:${cardNumber}:${scenario}`
    expect(parseTestStateConfig(route, 'localhost')).toEqual({
      kind: 'st10-item', cardNumber, scenario,
    })
    expect(parseTestStateConfig(route, 'example.com')).toBeNull()
    assertPhysicalDecks(createSt1014To016ItemPreviewState(cardNumber, scenario))
  })

  it('ST10-014 pays P and trashes exactly one own purple LV1 Cookie before optional effect damage', () => {
    const state = createSt1014To016ItemPreviewState('ST10-014', 'positive')
    const own = state.players[one]
    const foe = state.players[two]
    const source = own.hand[0]!
    const payment = own.supportArea[0]!.card
    const material = own.battleArea[1]!
    const target = foe.battleArea[0]!
    expect([material.card.id, material.card.energyColor, material.card.level]).toEqual(['ST5-005', 'purple', 1])
    expect(canPlayItem(state, one, source.instanceId)).toBe(true)
    const resolved = settleDamage(playItem(state, 'ST10-014', [target.card.instanceId]))
    expect(resolved.players[two].battleArea.find(entry => entry.card.instanceId === target.card.instanceId)?.hpCards)
      .toHaveLength(target.hpCards.length - 1)
    expect(resolved.players[one].battleArea.map(entry => entry.card.instanceId)).toEqual([own.battleArea[0]!.card.instanceId])
    expect(resolved.players[one].discardPile.map(card => card.instanceId)).toEqual(
      expect.arrayContaining([material.card.instanceId, ...material.hpCards.map(card => card.instanceId), source.instanceId]),
    )
    expect(resolved.players[one].supportArea.filter(entry => entry.rested)).toHaveLength(1)
    expect(resolved.players[one].supportArea.find(entry => entry.card.instanceId === payment.instanceId)?.rested).toBe(true)
    expect(resolved.players[two].discardPile).toHaveLength(1)
    assertPhysicalDecks(resolved)
  })

  it('ST10-014 pays its costs even when the optional target is zero, and rejects an ineligible sacrifice', () => {
    const state = createSt1014To016ItemPreviewState('ST10-014', 'positive')
    const target = state.players[two].battleArea[0]!
    const zero = settleDamage(playItem(state, 'ST10-014', []))
    expect(zero.players[two].battleArea.find(entry => entry.card.instanceId === target.card.instanceId)?.hpCards)
      .toEqual(target.hpCards)
    expect(zero.players[one].battleArea).toHaveLength(1)
    expect(zero.players[one].discardPile.some(card => card.id === 'ST5-005')).toBe(true)

    const noMaterial = createSt1014To016ItemPreviewState('ST10-014', 'no-material')
    const source = noMaterial.players[one].hand[0]!
    const snapshot = structuredClone(noMaterial)
    expect(noMaterial.players[one].battleArea.every(entry => entry.card.energyColor !== 'purple' || entry.card.level !== 1)).toBe(true)
    expect(canPlayItem(noMaterial, one, source.instanceId)).toBe(false)
    expect(() => playItem(noMaterial, 'ST10-014', [noMaterial.players[two].battleArea[0]!.card.instanceId])).toThrow()
    expect(noMaterial).toEqual(snapshot)
    assertPhysicalDecks(zero)
  })

  it.each(['battle-witness', 'trash-witness'] as const)(
    'ST10-015 pays PP and removes HP from only the selected opponent Cookie when Moonlight is in %s',
    scenario => {
      const state = createSt1014To016ItemPreviewState('ST10-015', scenario)
      const own = state.players[one]
      const foe = state.players[two]
      const source = own.hand[0]!
      const target = foe.battleArea[0]!
      const untouched = foe.battleArea[1]!
      const removedHp = target.hpCards.at(-1)!
      expect(own.battleArea.some(entry => entry.card.name === 'Moonlight Cookie') ||
        own.discardPile.some(card => card.type === 'cookie' && card.name === 'Moonlight Cookie')).toBe(true)
      const effect = source.type === 'item' ? source.item?.effects[0] : undefined
      if (!effect) throw new Error('ST10-015 converted effect is missing')
      expect(isEffectConditionMet(state, { sourcePlayerId: one, sourceInstanceId: source.instanceId }, effect)).toBe(true)

      const resolved = settleDamage(playItem(state, 'ST10-015', [target.card.instanceId]))
      expect(resolved.players[two].battleArea.find(entry => entry.card.instanceId === target.card.instanceId)?.hpCards)
        .toHaveLength(target.hpCards.length - 1)
      expect(resolved.players[two].battleArea.find(entry => entry.card.instanceId === untouched.card.instanceId)?.hpCards)
        .toEqual(untouched.hpCards)
      expect(resolved.players[two].discardPile.map(card => card.instanceId)).toContain(removedHp.instanceId)
      expect(resolved.players[one].discardPile.map(card => card.instanceId)).not.toContain(removedHp.instanceId)
      expect(resolved.players[one].discardPile.map(card => card.instanceId)).toContain(source.instanceId)
      expect(resolved.pendingBattle).toBeNull()
      expect(resolved.players[one].supportArea.filter(entry => entry.rested)).toHaveLength(2)
      assertPhysicalDecks(resolved)
    },
  )

  it('ST10-015 pays PP when Moonlight is absent, but the condition prevents HP movement; zero targets remain legal', () => {
    const state = createSt1014To016ItemPreviewState('ST10-015', 'no-witness')
    const own = state.players[one]
    const target = state.players[two].battleArea[0]!
    const source = own.hand[0]!
    const effect = source.type === 'item' ? source.item?.effects[0] : undefined
    if (!effect) throw new Error('ST10-015 converted effect is missing')
    expect(isEffectConditionMet(state, { sourcePlayerId: one, sourceInstanceId: source.instanceId }, effect)).toBe(false)
    expect(canPlayItem(state, one, source.instanceId)).toBe(true)
    const zero = settleDamage(playItem(state, 'ST10-015', []))
    expect(zero.players[two].battleArea.find(entry => entry.card.instanceId === target.card.instanceId)?.hpCards)
      .toEqual(target.hpCards)
    expect(zero.players[one].discardPile.map(card => card.instanceId)).toContain(source.instanceId)
    expect(zero.players[one].supportArea.filter(entry => entry.rested)).toHaveLength(2)
    assertPhysicalDecks(zero)
  })

  it('ST10-016 counts its own Item in trash before checking the 15-card effect threshold', () => {
    const state = createSt1014To016ItemPreviewState('ST10-016', 'fifteen-trash')
    const target = state.players[two].battleArea[0]!
    const source = state.players[one].hand[0]!
    const effect = source.type === 'item' ? source.item?.effects[0] : undefined
    if (!effect) throw new Error('ST10-016 converted effect is missing')
    expect(state.players[one].discardPile).toHaveLength(15)
    expect(isEffectConditionMet(state, { sourcePlayerId: one, sourceInstanceId: source.instanceId }, effect)).toBe(true)
    const damaged = settleDamage(playItem(state, 'ST10-016', [target.card.instanceId]))
    expect(damaged.players[two].battleArea.find(entry => entry.card.instanceId === target.card.instanceId)?.hpCards)
      .toHaveLength(target.hpCards.length - 1)
    expect(damaged.players[one].discardPile).toHaveLength(16)
    expect(damaged.players[one].supportArea.filter(entry => entry.rested)).toHaveLength(1)

    const fourteen = createSt1014To016ItemPreviewState('ST10-016', 'fourteen-trash')
    const fourteenSource = fourteen.players[one].hand[0]!
    const fourteenTarget = fourteen.players[two].battleArea[0]!
    const fourteenEffect = fourteenSource.type === 'item' ? fourteenSource.item?.effects[0] : undefined
    if (!fourteenEffect) throw new Error('ST10-016 converted effect is missing')
    expect(fourteen.players[one].discardPile).toHaveLength(14)
    expect(isEffectConditionMet(fourteen, { sourcePlayerId: one, sourceInstanceId: fourteenSource.instanceId }, fourteenEffect)).toBe(false)
    expect(canPlayItem(fourteen, one, fourteenSource.instanceId)).toBe(true)
    const fourteenResolved = settleDamage(playItem(fourteen, 'ST10-016', [fourteenTarget.card.instanceId]))
    expect(fourteenResolved.players[two].battleArea.find(entry => entry.card.instanceId === fourteenTarget.card.instanceId)?.hpCards)
      .toHaveLength(fourteenTarget.hpCards.length - 1)
    expect(fourteenResolved.players[one].discardPile).toHaveLength(15)
    expect(fourteenResolved.players[one].supportArea.filter(entry => entry.rested)).toHaveLength(1)

    const thirteen = createSt1014To016ItemPreviewState('ST10-016', 'thirteen-trash')
    const thirteenSource = thirteen.players[one].hand[0]!
    const thirteenTarget = thirteen.players[two].battleArea[0]!
    const thirteenEffect = thirteenSource.type === 'item' ? thirteenSource.item?.effects[0] : undefined
    if (!thirteenEffect) throw new Error('ST10-016 converted effect is missing')
    expect(thirteen.players[one].discardPile).toHaveLength(13)
    expect(isEffectConditionMet(thirteen, { sourcePlayerId: one, sourceInstanceId: thirteenSource.instanceId }, thirteenEffect)).toBe(false)
    expect(canPlayItem(thirteen, one, thirteenSource.instanceId)).toBe(true)
    const noEffect = settleDamage(playItem(thirteen, 'ST10-016', [thirteenTarget.card.instanceId]))
    expect(noEffect.players[two].battleArea.find(entry => entry.card.instanceId === thirteenTarget.card.instanceId)?.hpCards)
      .toEqual(thirteenTarget.hpCards)
    expect(noEffect.players[one].discardPile).toHaveLength(14)
    expect(noEffect.players[one].discardPile.map(card => card.instanceId)).toContain(thirteenSource.instanceId)
    expect(noEffect.players[one].supportArea.filter(entry => entry.rested)).toHaveLength(1)
    assertPhysicalDecks(damaged)
    assertPhysicalDecks(fourteenResolved)
    assertPhysicalDecks(noEffect)
  })
})
