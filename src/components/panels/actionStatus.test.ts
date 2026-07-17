import { describe, expect, it } from 'vitest'
import { createBattleState } from '../../game/test-helpers/battle-helpers'
import type { PublicIntent } from '../../net/onlineProtocol'
import { deriveActionStatus } from './actionStatus'

describe('deriveActionStatus', () => {
  it('把對手選擇目標轉成非阻塞的對手動作提示', () => {
    const game = createBattleState()
    const intent: PublicIntent = {
      type: 'selecting-target',
      intentId: 'player-one-3',
      actorId: 'player-one',
      sequence: 3,
      stateVersion: 8,
      updatedAt: '2026-07-16T00:00:00.000Z',
      targetScope: 'opponent-battle-cookie',
      requiredCount: 1,
      selectedCount: 0,
    }

    const status = deriveActionStatus({
      game,
      viewerPlayerId: 'player-two',
      publicIntent: intent,
    })

    expect(status.mode).toBe('opponent-thinking')
    expect(status.headline).toContain(game.players['player-one'].name)
    expect(status.progress?.find((step) => step.key === 'target')?.state).toBe(
      'active',
    )
  })

  it('在本機攻擊支付完成後提示下一步目標選擇', () => {
    const game = createBattleState()
    const status = deriveActionStatus({
      game,
      viewerPlayerId: 'player-one',
      local: {
        selectedAttackerId: game.players['player-one'].battleArea[0]?.card.instanceId,
        attackPaymentValid: true,
      },
    })

    expect(status.mode).toBe('awaiting-local-decision')
    expect(status.headline).toContain('攻擊目標')
  })
})
