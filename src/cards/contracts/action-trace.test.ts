import { describe, expect, it } from 'vitest'
import {
  attestCardContractActionTrace,
  buildCardContractActionTrace,
  traceContainsCommandKinds,
  traceHasSubstantiveEffectEvidence,
} from './action-trace'
import type { CommandLogEntry } from '../../game'

describe('card contract action trace', () => {
  it('keeps public steps while excluding raw payload data', () => {
    const entries: CommandLogEntry[] = [
      {
        id: 1,
        turnNumber: 1,
        phase: 'main',
        playerId: 'player-one',
        commandKind: 'activate-skill',
        payload: { handCardIds: ['private-card'] },
        card: { id: 'BS6-101', instanceId: 'x', name: 'fixture', type: 'cookie', level: 1, hp: 2, attack: 1, attackCost: 0, attackEnergyCost: {} },
        steps: [{ text: '支付紫色能量' }],
      },
      {
        id: 2,
        turnNumber: 1,
        phase: 'main',
        playerId: 'player-one',
        commandKind: 'resolve-faint-effect',
        payload: { selectedIds: ['private-card'] },
        card: { id: 'BS6-101', instanceId: 'x', name: 'fixture', type: 'cookie', level: 1, hp: 2, attack: 1, attackCost: 0, attackEnergyCost: {} },
        steps: [{ text: '選擇棄牌區餅乾登場' }],
      },
    ]
    const trace = buildCardContractActionTrace(entries, 'BS6-101')
    expect(trace).toHaveLength(2)
    expect(trace[0]).not.toHaveProperty('payload')
    expect(trace.map((entry) => entry.steps)).toEqual([['支付紫色能量'], ['選擇棄牌區餅乾登場']])
    expect(traceContainsCommandKinds(trace, ['activate-skill', 'resolve-faint-effect'])).toBe(true)

    expect(attestCardContractActionTrace(trace, {
      requiredCommandKinds: ['activate-skill', 'resolve-faint-effect'],
      orderedStepFragments: ['支付紫色能量', '選擇棄牌區餅乾登場'],
    })).toMatchObject({ passed: true })

    const failed = attestCardContractActionTrace(trace, {
      requiredCommandKinds: ['resolve-faint-effect'],
      orderedStepFragments: ['未出現的步驟'],
    })
    expect(failed.passed).toBe(false)
    expect(failed.errors).toContain('missing ordered step: 未出現的步驟')
  })

  it('rejects source/payment-only traces and requires effect settlement evidence', () => {
    expect(
      traceHasSubstantiveEffectEvidence([
        {
          id: 1,
          commandKind: 'play-trap',
          steps: ['發動陷阱卡：「fixture」', '支付能量（橫置）：support-1'],
        },
      ]),
    ).toBe(false)
    expect(
      traceHasSubstantiveEffectEvidence([
        {
          id: 1,
          commandKind: 'declare-attack',
          steps: ['宣告攻擊：「fixture」→「target」', '自動結算戰鬥，未造成傷害'],
        },
      ]),
    ).toBe(false)
    expect(
      traceHasSubstantiveEffectEvidence([
        {
          id: 1,
          commandKind: 'play-trap',
          steps: [
            '發動陷阱卡：「fixture」',
            '選擇目標：target',
            'Then 效果：棄牌區卡片洗回牌庫：trash-1',
          ],
        },
      ]),
    ).toBe(true)
  })
})
