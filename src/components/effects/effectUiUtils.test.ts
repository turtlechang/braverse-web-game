import { describe, expect, it } from 'vitest'
import { describeEffect, describeEffectResult, getSkillLabels } from './effectUiUtils'
import type {
  BreakToTrashEffect,
  FieldToTrashEffect,
  TrashToBattleEffect,
} from '../../game'
import type { DamageEffect, DeckToTrashEffect, SupportToBattleEffect } from '../../game/types'

describe('damage-all recipient description', () => {
  it('preserves the source exclusion in BS8-005 attack text', () => {
    expect(describeEffect({ kind: 'damage-all', amount: 1, side: 'self', excludeSource: true }))
      .toBe('來源以外的所有我方餅乾受到 1 傷害。')
    expect(describeEffect({ kind: 'damage-all', amount: 1, side: 'opponent' }))
      .toBe('所有對手餅乾受到 1 傷害。')
  })
})

describe('optional gain-hp description', () => {
  it('shows the exact effective HP filter and explicit zero choice', () => {
    expect(describeEffect({ kind: 'gain-hp', amount: 1, target: {
      side: 'self', min: 0, max: 1, minRemainingHp: 1, maxRemainingHp: 1,
    } })).toBe('選擇最多 1 張剛好剩 1 HP 的我方餅乾，獲得 1 HP（可選 0 張）。')
  })
})

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

describe('describeEffect for prevent-support-active-next-phase', () => {
  it('describes BS8-042 as an optional opponent support choice for only the next Active Phase', () => {
    const description = describeEffect({
      kind: 'prevent-support-active-next-phase',
      target: { side: 'opponent', min: 0, max: 1 },
    })
    expect(description).toBe('選擇至多 1 張對手支援卡；所選卡在對手下一個活躍階段不會設為活躍（不立即橫置）。')
    expect(description).not.toContain('餅乾')
    expect(description).not.toContain('永久')
    expect(description).not.toContain('立即休息')
  })

  it('preserves a mandatory exact count and the self-side phase owner', () => {
    expect(describeEffect({
      kind: 'prevent-support-active-next-phase',
      target: { side: 'self', min: 2, max: 2 },
    })).toBe('選擇2 張我方支援卡；所選卡在我方下一個活躍階段不會設為活躍（不立即橫置）。')
  })

  it('preserves a positive selection minimum and each controller for both sides', () => {
    expect(describeEffect({
      kind: 'prevent-support-active-next-phase',
      target: { side: 'either', min: 1, max: 2 },
    })).toBe('選擇1～2 張雙方支援卡；所選卡在各自控制者下一個活躍階段不會設為活躍（不立即橫置）。')
  })
})

describe('describeEffectResult for break-to-trash', () => {
  it('describes same-level cost targets without an undefined printed level', () => {
    expect(describeEffect({ kind: 'break-to-trash', max: 1, sameLevelAsPreviousEffectTarget: true })).toContain('同等級')
    expect(describeEffect({ kind: 'break-to-trash', max: 1 })).not.toContain('undefined')
  })
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

describe('describeEffect for source-only field-to-trash', () => {
  const effect: FieldToTrashEffect = {
    kind: 'field-to-trash',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  }

  it('does not present the source Cookie as a player-selected Cookie or Stage', () => {
    expect(describeEffect(effect)).toBe('將這張餅乾放入棄牌區。')
    expect(describeEffect(effect)).not.toContain('選擇')
    expect(describeEffect(effect)).not.toContain('場景')
  })

  it('describes the source movement without requiring a target id', () => {
    expect(describeEffectResult(effect, [])).toBe('這張餅乾已放入棄牌區。')
  })
})

describe('describeEffect for selectable field-to-trash', () => {
  it('mentions Stage only when the effect explicitly allows Stage', () => {
    const cookieOnly: FieldToTrashEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1 },
    }
    const cookieOrStage: FieldToTrashEffect = {
      ...cookieOnly,
      allowStage: true,
    }

    expect(describeEffect(cookieOnly)).toBe(
      '選擇 1 張對手餅乾，放入棄牌區。',
    )
    expect(describeEffect(cookieOrStage)).toBe(
      '選擇 1 張對手餅乾或場景，放入棄牌區。',
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
