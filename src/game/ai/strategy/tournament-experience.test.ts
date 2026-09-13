import { describe, expect, it } from 'vitest'
import {
  createCard,
  createDemoGame,
  createPlayerView,
  createExtraDeckForChoice,
  getCardPoolEntry,
  type AiDecisionProfile,
  type AiTournamentExperienceProfile,
} from '../../index'
import {
  createAiTournamentExperienceAccumulator,
  finalizeAiTournamentExperience,
  recordAiTournamentMatchExperience,
  scoreTournamentExperience,
} from './tournament-experience'

const profile: AiTournamentExperienceProfile = {
  schemaVersion: 1,
  id: 'test-bs9-experience',
  strategyVersion: 'test',
  scope: { series: 'BS9' },
  source: {
    tournamentId: 'test',
    rosterSize: 8,
    rounds: 3,
    swissMatches: 12,
    seed: 1,
    generatedAt: '2026-09-13T00:00:00.000+08:00',
  },
  actionWeights: { 'deploy-cookie': 8 },
  cardActionWeights: { 'BS9-050': { 'deploy-cookie': 7 } },
  sampleCounts: {
    actions: { 'deploy-cookie': 20 },
    cardActions: { 'BS9-050': { 'deploy-cookie': 5 } },
  },
}

const viewWithBs9Card = () => {
  const state = createDemoGame(1)
  const source = getCardPoolEntry('BS9-050')
  if (!source) throw new Error('BS9-050 不在 runtime card pool')
  const card = createCard(source, 'player-one', 1)
  const stateWithCard = {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [card, ...state.players['player-one'].hand],
      },
    },
  }
  return { card, view: createPlayerView(stateWithCard, 'player-one') }
}

const learnedDecisions: AiDecisionProfile = {
  totalDecisions: 10,
  byAction: { 'deploy-cookie': 5 },
  byCardAction: { 'BS9-050': { 'deploy-cookie': 5 } },
}

describe('Lv.5 BS9 賽事經驗', () => {
  it('只對 PlayerView 可見的 BS9 來源卡套用有界修正', () => {
    const { card, view } = viewWithBs9Card()
    const adjustment = scoreTournamentExperience(profile, view, {
      kind: 'deploy-cookie',
      sourceInstanceId: card.instanceId,
    })

    expect(adjustment.amount).toBe(9)
    expect(adjustment.detail).toContain('BS9-050')
    expect(scoreTournamentExperience(profile, view, {
      kind: 'deploy-cookie',
      sourceInstanceId: 'hidden-card',
    }).amount).toBe(0)
    expect(scoreTournamentExperience({ ...profile, scope: { series: 'BS8' } }, view, {
      kind: 'deploy-cookie',
      sourceInstanceId: card.instanceId,
    }).amount).toBe(0)
  })

  it('持有者可見的 BS9 EXTRA 來源卡也會取得卡片專屬賽事修正', () => {
    const state = createDemoGame(1)
    const extraDeck = createExtraDeckForChoice('bs9-red-truth', 'player-one')
    const stateWithExtra = {
      ...state,
      players: {
        ...state.players,
        'player-one': { ...state.players['player-one'], extraDeck },
      },
    }
    const view = createPlayerView(stateWithExtra, 'player-one')
    const adjustment = scoreTournamentExperience({
      ...profile,
      cardActionWeights: { 'BS9-010': { 'play-extra-deck-cookie': 11 } },
      sampleCounts: { ...profile.sampleCounts, cardActions: { 'BS9-010': { 'play-extra-deck-cookie': 5 } } },
    }, view, {
      kind: 'play-extra-deck-cookie',
      sourceInstanceId: extraDeck[0]?.instanceId,
    })

    expect(adjustment.amount).toBe(11)
    expect(adjustment.detail).toContain('BS9-010')
  })

  it('只從有勝負的比賽累積樣本，並將權重限制在 -24 到 +24', () => {
    const accumulator = createAiTournamentExperienceAccumulator()
    for (let index = 0; index < 3; index += 1) {
      recordAiTournamentMatchExperience(
        accumulator,
        { 'player-one': learnedDecisions },
        'player-one',
      )
    }
    recordAiTournamentMatchExperience(accumulator, {
      'player-one': learnedDecisions,
    }, null)

    const finalized = finalizeAiTournamentExperience(accumulator, {
      id: 'test-bs9-experience',
      strategyVersion: 'test',
      series: 'BS9',
      source: profile.source,
    })

    expect(accumulator.matches).toBe(3)
    expect(accumulator.decisiveMatches).toBe(3)
    expect(finalized.actionWeights['deploy-cookie']).toBe(12)
    expect(finalized.cardActionWeights['BS9-050']?.['deploy-cookie']).toBe(12)
    expect(Math.abs(finalized.actionWeights['deploy-cookie'] ?? 0)).toBeLessThanOrEqual(24)
  })
})
