import { describe, expect, it } from 'vitest'
import type { GameCard } from '../../game'
import { createBattleState, cookie } from '../../game/test-helpers/battle-helpers'
import { getZeroBreakCountWarning } from './trapWarnings'

// BS3-045（至尊國君的反擊）官方文字沒有「休息區要有 LV.3 才能發動」這種
// 前置條件，只是傷害量按休息區 LV.3 張數縮放（0 張時就是 0 傷害），陷阱
// 本身仍可正常發動。這裡驗證的是額外加上去的 UI 體驗提示：休息區沒有
// 符合條件的餅乾時，提前告知玩家「這個效果不會有實質作用」，而不是讓
// 玩家發動後才發現白打了一張陷阱。
const counterattackTrap = (): GameCard => ({
  id: 'BS3-045',
  instanceId: 'bs3-045-test',
  name: "Golden Monarch's Counterattack",
  type: 'trap',
  officialType: 'trap',
  energyColor: 'yellow',
  trap: {
    text: 'Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage for each LV.3 Cookie in your break area.',
    cost: { energy: { yellow: 2 }, discardHand: 0 },
    effects: [
      {
        kind: 'damage-by-break-count',
        perCount: 1,
        exactBreakLevel: 3,
        target: { side: 'opponent', min: 0, max: 1 },
      },
    ],
  },
})

describe('getZeroBreakCountWarning', () => {
  it('warns when the selected trap deals 0 damage due to no matching break-area Cookies', () => {
    const state = createBattleState()
    state.players['player-one'].breakArea = []
    const trap = counterattackTrap()

    const warning = getZeroBreakCountWarning({
      playerTrapCandidates: [trap],
      selectedTrapId: trap.instanceId,
      game: state,
      viewerPlayerId: 'player-one',
    })

    expect(warning).toBe(
      '目前休息區沒有符合條件的餅乾，這個效果將不會造成任何傷害。',
    )
  })

  it('does not warn when the break area has a matching LV.3 Cookie', () => {
    const state = createBattleState()
    state.players['player-one'].breakArea = [{ ...cookie('p1-lv3'), level: 3 }]
    const trap = counterattackTrap()

    const warning = getZeroBreakCountWarning({
      playerTrapCandidates: [trap],
      selectedTrapId: trap.instanceId,
      game: state,
      viewerPlayerId: 'player-one',
    })

    expect(warning).toBeNull()
  })

  it('does not warn when no trap is selected', () => {
    const state = createBattleState()
    const trap = counterattackTrap()

    const warning = getZeroBreakCountWarning({
      playerTrapCandidates: [trap],
      selectedTrapId: null,
      game: state,
      viewerPlayerId: 'player-one',
    })

    expect(warning).toBeNull()
  })

  it('does not warn for traps without any damage-by-break-count/modify-attack-by-break-count effect', () => {
    const state = createBattleState()
    const plainTrap: GameCard = {
      id: 'ST2-020',
      instanceId: 'st2-020-test',
      name: 'Winding Key Shield',
      type: 'trap',
      officialType: 'trap',
      energyColor: 'yellow',
      trap: {
        text: 'Select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -3 attack damage.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }

    const warning = getZeroBreakCountWarning({
      playerTrapCandidates: [plainTrap],
      selectedTrapId: plainTrap.instanceId,
      game: state,
      viewerPlayerId: 'player-one',
    })

    expect(warning).toBeNull()
  })
})
