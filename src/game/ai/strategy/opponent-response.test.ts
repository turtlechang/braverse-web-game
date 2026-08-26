import { describe, expect, it } from 'vitest'
import { createDemoGame } from '../../demo'
import { createPlayerView, type PlayerView } from '../../player-view'
import type { GameCard } from '../../types'
import { item } from '../../test-helpers/battle-helpers'
import { estimateOpponentResponse } from './opponent-response'

const responseCard = (id: string): GameCard => ({
  id,
  instanceId: `${id}-instance`,
  name: '公開 Block 證據',
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 1,
  skill: {
    trigger: 'block',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: {},
    effects: [],
    text: 'Block',
  },
})

const attackIdentity = (view: PlayerView) => ({
  kind: 'attack',
  sourceInstanceId: view.self.battleArea[0]?.card.instanceId,
  targetInstanceId: view.opponent.battleArea[0]?.card.instanceId,
})

describe('Lv.5 公開資訊對手回應模型', () => {
  it('非攻擊行動維持中性', () => {
    const view = createPlayerView(createDemoGame(1), 'player-one')
    expect(estimateOpponentResponse(view, { kind: 'play-support' }))
      .toMatchObject({ responseLikelihood: 0, expectedPenalty: 0 })
  })

  it('公開回應能力證據會提高攻擊風險，且結果 deterministic', () => {
    const base = createPlayerView(createDemoGame(3), 'player-one')
    const withoutEvidence: PlayerView = {
      ...base,
      opponent: {
        ...base.opponent,
        handCount: 5,
        battleArea: [],
        supportArea: [],
        breakArea: [],
        discardPile: [],
        stage: null,
      },
    }
    const withEvidence: PlayerView = {
      ...withoutEvidence,
      opponent: {
        ...withoutEvidence.opponent,
        discardPile: [responseCard('fixture-public-block')],
      },
    }
    const identity = attackIdentity(withoutEvidence)
    const low = estimateOpponentResponse(withoutEvidence, identity)
    const high = estimateOpponentResponse(withEvidence, identity)

    expect(high.publicResponseEvidence).toBe(1)
    expect(high.responseLikelihood).toBeGreaterThan(low.responseLikelihood)
    expect(high.expectedPenalty).toBeLessThan(low.expectedPenalty)
    expect(estimateOpponentResponse(withEvidence, identity)).toEqual(high)
  })

  it('對手公開手牌為 0 時不臆測可從隱藏區回應', () => {
    const view = createPlayerView(createDemoGame(4), 'player-one')
    const noHand = {
      ...view,
      opponent: { ...view.opponent, handCount: 0 },
    }
    expect(estimateOpponentResponse(noHand, attackIdentity(noHand)))
      .toMatchObject({ responseLikelihood: 0, expectedPenalty: 0 })
  })

  it('會把對手保留的活躍支援視為未知陷阱／防禦的公開容量訊號', () => {
    const base = createPlayerView(createDemoGame(5), 'player-one')
    const view: PlayerView = {
      ...base,
      opponent: {
        ...base.opponent,
        handCount: 4,
        battleArea: [],
        supportArea: [
          { card: item('opponent-active-red'), rested: false },
          { card: item('opponent-active-yellow'), rested: false },
          { card: item('opponent-rested'), rested: true },
        ],
        breakArea: [],
        discardPile: [],
        stage: null,
      },
    }
    const estimate = estimateOpponentResponse(view, {
      kind: 'attack',
      sourceInstanceId: view.self.battleArea[0]?.card.instanceId,
      targetInstanceId: 'missing-target',
    })

    expect(estimate.activeSupportCount).toBe(2)
    expect(estimate.hiddenHandEnergyCapacity).toBe(2)
    expect(estimate.responseBranches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'reserved-energy-threat', evidence: 2 }),
      ]),
    )
    expect(estimate.worstCaseKind).toBe('reserved-energy-threat')
  })
})
