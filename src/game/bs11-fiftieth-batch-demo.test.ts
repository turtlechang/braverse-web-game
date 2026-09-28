import { describe, expect, it } from 'vitest'
import {
  createBs11ThirteenthBatchDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-045 to BS11-049 localhost Browser fixtures', () => {
  it('parses positive, negative, and replacement follow-through routes', () => {
    expect(parseTestStateConfig(
      '?test-state=bs11-thirteenth-batch:BS11-045:positive',
      'localhost',
    )).toEqual({
      kind: 'bs11-thirteenth-batch',
      cardNumber: 'BS11-045',
      scenario: 'positive',
    })
    expect(parseTestStateConfig(
      '?test-state=bs11-thirteenth-batch:BS11-046:negative',
      'localhost',
    )).toEqual({
      kind: 'bs11-thirteenth-batch',
      cardNumber: 'BS11-046',
      scenario: 'negative',
    })
    expect(parseTestStateConfig(
      '?test-state=bs11-thirteenth-batch:BS11-047:replacement',
      'localhost',
    )).toEqual({
      kind: 'bs11-thirteenth-batch',
      cardNumber: 'BS11-047',
      scenario: 'replacement',
    })
    expect(parseTestStateConfig(
      '?test-state=bs11-thirteenth-batch:BS11-048@1:positive',
      'localhost',
    )).toEqual({
      kind: 'bs11-thirteenth-batch',
      cardNumber: 'BS11-048@1',
      scenario: 'positive',
    })
  })

  it('keeps BS11-045 placement and activation witnesses on the actual green-cost route', () => {
    const positive = createBs11ThirteenthBatchDemoState('BS11-045', 'positive')
    const positivePlayer = positive.players['player-one']
    expect(positivePlayer.hand[0]).toMatchObject({ id: 'BS11-045', type: 'stage' })
    expect(positivePlayer.stage).toBeNull()
    expect(positivePlayer.supportArea.filter(({ card }) => card.energyColor === 'green'))
      .toHaveLength(3)
    expect(positivePlayer.battleArea.filter(({ card, rested }) =>
      card.energyColor === 'green' && rested,
    )).toHaveLength(2)
    expect(positivePlayer.battleArea.filter(({ card, rested }) =>
      card.energyColor === 'red' && rested,
    )).toHaveLength(1)

    const negative = createBs11ThirteenthBatchDemoState('BS11-045', 'negative')
    expect(negative.players['player-one'].stage?.card.id).toBe('BS11-045')
    expect(negative.players['player-one'].supportArea.filter(({ card, rested }) =>
      card.energyColor === 'green' && !rested,
    )).toHaveLength(1)
  })

  it('sets BS11-046 support-count A/B states around the exact two-support threshold', () => {
    const positive = createBs11ThirteenthBatchDemoState('BS11-046', 'positive')
    const negative = createBs11ThirteenthBatchDemoState('BS11-046', 'negative')
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(positive.players['player-one'].supportArea).toHaveLength(2)
    expect(positive.players['player-two'].supportArea).toHaveLength(4)
    expect(negative.players['player-two'].supportArea).toHaveLength(3)
    expect(positive.players['player-one'].hand[0]).toMatchObject({ id: 'BS11-046', type: 'trap' })
  })

  it('prepares BS11-047 UI payment and a real-command replacement follow-through', () => {
    const positive = createBs11ThirteenthBatchDemoState('BS11-047', 'positive')
    expect(positive.players['player-one'].hand.some((card) => card.id === 'BS11-047')).toBe(true)
    expect(positive.players['player-one'].supportArea.some((support) => !support.rested)).toBe(true)

    const replacement = createBs11ThirteenthBatchDemoState('BS11-047', 'replacement')
    expect(replacement.activePlayerId).toBe('player-two')
    expect(replacement.onPlayReplacementUntilTurn?.['player-two']).toMatchObject({
      turn: replacement.turnNumber,
      cost: { energy: { neutral: 1 } },
      effects: [{ kind: 'support-to-hand', amount: 1 }],
    })
    expect(replacement.pendingOnPlay).toMatchObject({
      playerId: 'player-two',
      sourceInstanceId: 'bs11-047-opponent-on-play-witness',
      origin: 'hand',
    })
    expect(replacement.players['player-two'].hand).toEqual([])
    expect(replacement.players['player-two'].battleArea[0]?.card.skill?.trigger).toBe('on-play')
    expect(replacement.commandLog?.some((entry) => entry.commandKind === 'deploy-cookie')).toBe(true)
    expect(replacement.players['player-two'].supportArea).toHaveLength(2)
  })

  it('includes the Wind Archer condition and a selectable opposing support for BS11-048', () => {
    const positive = createBs11ThirteenthBatchDemoState('BS11-048', 'positive')
    const alternateArt = createBs11ThirteenthBatchDemoState('BS11-048@1', 'positive')
    const negative = createBs11ThirteenthBatchDemoState('BS11-048', 'negative')
    expect(positive.players['player-one'].battleArea.some(
      ({ card }) => card.name === 'Wind Archer Cookie',
    )).toBe(true)
    expect(positive.players['player-two'].supportArea).toHaveLength(2)
    expect(negative.players['player-one'].battleArea.some(
      ({ card }) => card.name === 'Wind Archer Cookie' || card.keywords?.includes('ancient'),
    )).toBe(false)
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(positive.players['player-one'].battleArea.find(
      ({ card }) => card.instanceId === positive.pendingBattle?.targetInstanceId,
    )?.hpCards).toHaveLength(7)
    expect(alternateArt.players['player-one'].hand[0]).toMatchObject({
      id: 'BS11-048',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/D9F3lLXNvzCkyhHhKpYQ3A.webp',
    })
  })

  it('puts only a legal named Cookie in the BS11-049 positive trash route', () => {
    const positive = createBs11ThirteenthBatchDemoState('BS11-049', 'positive')
    const negative = createBs11ThirteenthBatchDemoState('BS11-049', 'negative')
    expect(positive.players['player-one'].discardPile.map((card) => card.name))
      .toEqual(['Wind Archer Cookie'])
    expect(negative.players['player-one'].discardPile.some(
      (card) => card.name === 'Wind Archer Cookie',
    )).toBe(false)
  })
})
