import { describe, expect, it } from 'vitest'
import { describeEffectResult } from './effectUiUtils'
import type { BreakToTrashEffect } from '../../game'

describe('describeEffectResult for break-to-trash', () => {
  const effect: BreakToTrashEffect = { kind: 'break-to-trash', max: 1, exactLevel: 1 }

  it('returns the no-target message when targetNames is empty', () => {
    expect(describeEffectResult(effect, [])).toBe('沒有選擇休息區目標。')
  })

  it('returns the trashed message when targets are selected', () => {
    expect(describeEffectResult(effect, ['ST1-009'])).toBe('break 區卡已放入棄牌區。')
  })
})
