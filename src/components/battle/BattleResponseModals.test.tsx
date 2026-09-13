import { describe, expect, it } from 'vitest'
import {
  buildTrapEffectTargetSubmission,
  shouldShowAttackResponseChooser,
} from './battleResponseSelectors'
import type { BattleUiMatchLike } from '../../hooks/battleUiContracts'

const pendingTrap = {
  stage: 'trap',
  defenderPlayerId: 'player-one',
} as BattleUiMatchLike['game']['pendingBattle']

describe('shouldShowAttackResponseChooser', () => {
  it('opens the trap flow directly when Trap is the only response family', () => {
    expect(
      shouldShowAttackResponseChooser({
        pendingBattle: pendingTrap,
        viewerPlayerId: 'player-one',
        pendingResponseMode: null,
        trapCount: 1,
        blockerCount: 0,
        attackResponseCount: 0,
      }),
    ).toBe(false)
  })

  it('shows the chooser when another response family is available', () => {
    expect(
      shouldShowAttackResponseChooser({
        pendingBattle: pendingTrap,
        viewerPlayerId: 'player-one',
        pendingResponseMode: null,
        trapCount: 1,
        blockerCount: 1,
        attackResponseCount: 0,
      }),
    ).toBe(true)
  })

  it('does not reopen the chooser after a response family is selected', () => {
    expect(
      shouldShowAttackResponseChooser({
        pendingBattle: pendingTrap,
        viewerPlayerId: 'player-one',
        pendingResponseMode: 'trap',
        trapCount: 1,
        blockerCount: 1,
        attackResponseCount: 0,
      }),
    ).toBe(false)
  })
})

describe('buildTrapEffectTargetSubmission', () => {
  it('does not invent an empty selection for a later card-selection Then', () => {
    expect(buildTrapEffectTargetSubmission(
      [{ effectIndex: 0 }],
      [['attacker'], []],
    )).toEqual([['attacker']])
  })

  it('keeps each rendered per-effect target selection aligned to its effect index', () => {
    expect(buildTrapEffectTargetSubmission(
      [{ effectIndex: 0 }, { effectIndex: 1 }],
      [['first'], ['second']],
    )).toEqual([['first'], ['second']])
  })
})
