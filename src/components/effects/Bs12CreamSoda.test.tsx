import { describe, expect, it } from 'vitest'
import { describeEffect } from './effectUiUtils'
import { createBs12CreamSodaDemoState } from '../../game/demo'

describe.each(['BS12-072', 'BS12-072@1'] as const)('%s target instruction', number => {
  it('shows the other-source, LV limit, own-side and Arena intersection', () => {
    const effect = createBs12CreamSodaDemoState('positive', number).players['player-one'].battleArea[0].card.skill!.effects[0]
    const instruction = describeEffect(effect)
    expect(instruction).toContain('我方餅乾')
    expect(instruction).toContain('來源以外')
    expect(instruction).toContain('LV.2 以下')
    expect(instruction).toContain('【Arena】')
    expect(instruction).toContain('最多 1 張')
    expect(instruction).toContain('牌庫底')
  })
})
