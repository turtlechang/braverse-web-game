import { describe, expect, it } from 'vitest'
import { describeEffect, describeEffectResult, getSkillLabels } from './effectUiUtils'
import type { BreakToTrashEffect, TrashToBattleEffect } from '../../game'
import type { DamageEffect, DeckToTrashEffect, SupportToBattleEffect } from '../../game/types'

describe('getSkillLabels for end-phase effects', () => {
  it('does not present a queued end-phase effect as Activate', () => {
    const skill = {
      trigger: 'passive' as const,
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {},
      text: 'At the end of your turn, return an HP card to your hand.',
      effects: [],
    }

    expect(getSkillLabels(skill, { endPhase: true })[0]).toBe('回合結束效果')
  })
})

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

describe('describeEffectResult for optional damage and support-to-battle', () => {
  it('does not report damage when the optional target selection is empty', () => {
    const effect: DamageEffect = {
      kind: 'damage',
      amount: 2,
      target: { side: 'opponent', min: 0, max: 1 },
    }

    expect(describeEffectResult(effect, [])).toBe(
      '未選擇傷害目標，效果未造成傷害。',
    )
  })

  it('does not report a support Cookie entering battle when none was selected', () => {
    const effect: SupportToBattleEffect = {
      kind: 'support-to-battle',
      amount: 1,
      optional: true,
    }

    expect(describeEffectResult(effect, [])).toBe(
      '未選擇支援區餅乾，已略過登場。',
    )
  })
})

describe('describeEffectResult for optional attack modification', () => {
  it('does not claim an attack modifier applied when no target was selected', () => {
    expect(
      describeEffectResult(
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 0, max: 1 },
        },
        [],
      ),
    ).toBe('未選擇攻擊力效果目標，未套用攻擊力修改。')
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
