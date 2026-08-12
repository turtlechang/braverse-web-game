import { describe, expect, it } from 'vitest'
import { describeEffect, describeEffectResult } from './effectUiUtils'
import type { BreakToTrashEffect, TrashToBattleEffect } from '../../game'
import type { DeckToTrashEffect } from '../../game/types'

describe('describeEffectResult for break-to-trash', () => {
  const effect: BreakToTrashEffect = { kind: 'break-to-trash', max: 1, exactLevel: 1 }

  it('returns the no-target message when targetNames is empty', () => {
    expect(describeEffectResult(effect, [])).toBe('沒有選擇休息區目標。')
  })

  it('returns the trashed message when targets are selected', () => {
    expect(describeEffectResult(effect, ['ST1-009'])).toBe('break 區卡已放入棄牌區。')
  })
})

describe('describeEffectResult for optional trash-to-battle', () => {
  const effect: TrashToBattleEffect = {
    kind: 'trash-to-battle',
    amount: 1,
    optional: true,
  }

  it('does not claim that a Cookie entered battle when the optional selection is skipped', () => {
    expect(describeEffectResult(effect, [])).toBe(
      '未選擇棄牌區餅乾，已略過登場。',
    )
  })

  it('confirms the battle entry when a trash Cookie was selected', () => {
    expect(describeEffectResult(effect, ['BS6-106-purple-hp2-trash-cookie'])).toBe(
      '棄牌區餅乾已登場。',
    )
  })
})

describe('describeEffect for deck-to-trash', () => {
  const effect: DeckToTrashEffect = {
    kind: 'deck-to-trash',
    amount: 5,
    side: 'opponent',
  }

  it('identifies the opponent deck and the mandatory step', () => {
    expect(describeEffect(effect)).toBe(
      '強制：將對手牌庫頂 5 張牌放入棄牌區。',
    )
  })
})

describe('describeEffectResult for deck-to-trash', () => {
  const effect: DeckToTrashEffect = {
    kind: 'deck-to-trash',
    amount: 5,
    side: 'opponent',
  }

  it('confirms that the opponent mill was executed', () => {
    expect(describeEffectResult(effect, [])).toBe(
      '對手牌庫頂 5 張牌已放入棄牌區。',
    )
  })
})
