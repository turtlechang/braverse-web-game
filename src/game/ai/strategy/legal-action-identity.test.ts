import { describe, expect, it } from 'vitest'
import type { AttackCommand, DeployCookieCommand } from '../../commands'
import { legalActionIdentityKey } from './lv3-strategy'

describe('legalActionIdentityKey', () => {
  it('treats the same attack with a different support payment as one legal action', () => {
    const before: AttackCommand = {
      kind: 'attack',
      playerId: 'player-one',
      attackerInstanceId: 'peach-blossom',
      targetInstanceId: 'licorice',
      supportPaymentIds: ['support-1', 'support-2', 'support-3'],
    }
    const after: AttackCommand = {
      ...before,
      supportPaymentIds: ['support-2', 'support-3', 'support-4'],
    }

    expect(legalActionIdentityKey(after)).toBe(legalActionIdentityKey(before))
  })

  it('keeps a different attack target distinct', () => {
    const first: AttackCommand = {
      kind: 'attack',
      playerId: 'player-one',
      attackerInstanceId: 'peach-blossom',
      targetInstanceId: 'licorice',
      supportPaymentIds: ['support-1', 'support-2', 'support-3'],
    }
    const second: AttackCommand = { ...first, targetInstanceId: 'mold-dough' }

    expect(legalActionIdentityKey(second)).not.toBe(legalActionIdentityKey(first))
  })

  it('distinguishes normal deployment from Special Play but ignores which Cookie pays', () => {
    const regular: DeployCookieCommand = {
      kind: 'deploy-cookie',
      playerId: 'player-one',
      instanceId: 'venom-dough',
    }
    const specialPlay: DeployCookieCommand = {
      ...regular,
      specialPlayCookieInstanceIds: ['licorice-a'],
    }
    const otherSpecialPlayPayment: DeployCookieCommand = {
      ...regular,
      specialPlayCookieInstanceIds: ['licorice-b'],
    }

    expect(legalActionIdentityKey(specialPlay))
      .toBe(legalActionIdentityKey(otherSpecialPlayPayment))
    expect(legalActionIdentityKey(specialPlay)).not.toBe(legalActionIdentityKey(regular))
  })
})
