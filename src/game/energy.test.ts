import { describe, expect, it } from 'vitest'
import {
  selectEnergyPayment,
  validateEnergyPayment,
  type GameCard,
  type SupportCard,
} from '.'

const createSupport = (
  instanceId: string,
  energyColor: GameCard['energyColor'],
  rested = false,
): SupportCard => ({
  card: {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'item',
    energyColor,
  },
  rested,
})

describe('energy payment', () => {
  const supports = [
    createSupport('red', 'red'),
    createSupport('blue', 'blue'),
    createSupport('wild', 'wild'),
    createSupport('rested-red', 'red', true),
  ]

  it('validates colored and neutral energy selections', () => {
    expect(
      validateEnergyPayment(
        { red: 1, neutral: 1 },
        supports,
        ['red', 'blue'],
      ),
    ).toMatchObject({ valid: true })
  })

  it('reports wrong colors and incorrect card counts', () => {
    expect(
      validateEnergyPayment({ red: 1 }, supports, ['blue']),
    ).toMatchObject({
      valid: false,
      reason: '所選支援卡的能量顏色不符合費用需求。',
    })
    expect(
      validateEnergyPayment({ red: 2 }, supports, ['red']),
    ).toMatchObject({
      valid: false,
      reason: '需要選擇 2 張支援卡，目前已選 1 張。',
    })
  })

  it('uses wild energy for missing colors and ignores rested supports', () => {
    expect(
      validateEnergyPayment(
        { red: 2 },
        supports,
        ['red', 'wild'],
      ),
    ).toMatchObject({ valid: true })
    expect(
      selectEnergyPayment({ red: 2 }, supports),
    ).toEqual(['red', 'wild'])
  })
})
