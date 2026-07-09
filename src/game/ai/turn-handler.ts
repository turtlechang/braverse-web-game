import {
  deployCookie,
  placeSupportCard,
  replaceDefeatedCookie,
  skipDefeatedCookieReplacement,
} from '../actions'
import {
  activateStage,
  canActivateStage,
  playStage,
} from '../card-abilities'
import { beginAttack } from '../battle'
import { appendCommandLogEntry } from '../commands'
import { executeCardEffect } from '../effects'
import { getAttackEnergyCost, selectEnergyPayment } from '../energy'
import { getRefreshCandidates, refreshDeck } from '../refresh'
import {
  finalizePendingReplacements,
  getCurrentReplacementTask,
} from '../replacement'
import { skipCookieOnPlay } from '../skills'
import { advancePhase, canAttack } from '../turn'
import type {
  CardEffect,
  CookieInBattle,
  EffectContext,
  GameCard,
  GameState,
  PlayerId,
} from '../types'
import type { AiDecision } from './types'
import {
  evaluateHandQuality,
  chooseBestCookieToDeploy,
  getMatchupProfile,
} from './bs2MatchupProfiles'

export interface AiTurnStrategy {
  currentLevel?: number
  chooseEffectTargets: (
    state: GameState,
    context: EffectContext,
    effect: CardEffect,
  ) => string[]
  resolveCardAbility: (
    state: GameState,
    playerId: PlayerId,
    card: GameCard,
  ) => AiDecision | null
  resolveSkill: (
    state: GameState,
    playerId: PlayerId,
    source: CookieInBattle,
    trigger: 'activate' | 'on-play',
  ) => AiDecision | null
  chooseReplacement: (
    state: GameState,
    playerId: PlayerId,
    level?: number,
  ) => GameCard | undefined
  chooseAttackTarget: (
    state: GameState,
    playerId: PlayerId,
  ) => CookieInBattle | undefined
}

export const handleAiTurnState = (
  state: GameState,
  playerId: PlayerId,
  strategy: AiTurnStrategy,
): AiDecision => {
  if (state.pendingRefresh?.playerId === playerId) {
    const candidate = getRefreshCandidates(state, playerId)[0]
    if (!candidate) {
      return {
        state,
        action: 'error',
        description: 'AI 找不到可用的 Refresh 餅乾。',
        error: 'refresh-candidate-unavailable',
      }
    }
    return {
      state: appendCommandLogEntry(
        state,
        refreshDeck(state, playerId, candidate.instanceId),
        {
          kind: 'refresh-deck',
          playerId,
          cookieInstanceId: candidate.instanceId,
        },
      ),
      action: 'refresh',
      description: `${state.players[playerId].name}使用${candidate.name}完成 Refresh。`,
    }
  }

  const replacementTask = getCurrentReplacementTask(state)
  if (!state.pendingOnPlay && replacementTask?.playerId === playerId) {
    const replacement = strategy.chooseReplacement(state, playerId, strategy.currentLevel)
    if (!replacement) {
      return {
        state: appendCommandLogEntry(
          state,
          skipDefeatedCookieReplacement(state),
          { kind: 'skip-replacement', playerId },
        ),
        action: 'skip-replacement',
        description: `${state.players[playerId].name}選擇不補餅乾。`,
      }
    }
    const replacedState = appendCommandLogEntry(
      state,
      replaceDefeatedCookie(state, replacement.instanceId),
      { kind: 'replace-cookie', playerId, instanceId: replacement.instanceId },
    )
    const replaced = replacedState.players[playerId].battleArea.find(
      (cookie) => cookie.card.instanceId === replacement.instanceId,
    )
    const onPlay =
      replaced && !replacedState.pendingRefresh
        ? strategy.resolveSkill(replacedState, playerId, replaced, 'on-play')
        : null
    return {
      state:
        onPlay?.state ??
        (replacedState.pendingOnPlay && !replacedState.pendingRefresh
          ? appendCommandLogEntry(
              replacedState,
              skipCookieOnPlay(
                replacedState,
                playerId,
                replacement.instanceId,
              ),
              {
                kind: 'skip-on-play',
                playerId,
                sourceInstanceId: replacement.instanceId,
              },
            )
          : replacedState),
      action: 'replace-cookie',
      effectSelections: onPlay?.effectSelections,
      description: `${state.players[playerId].name}補充${replacement.name}到戰鬥區。`,
    }
  }

  if (state.pendingOnPlay?.playerId === playerId) {
    const source = state.players[playerId].battleArea.find(
      (cookie) =>
        cookie.card.instanceId === state.pendingOnPlay?.sourceInstanceId,
    )
    const onPlay = source
      ? strategy.resolveSkill(state, playerId, source, 'on-play')
      : null
    return (
      onPlay ?? {
        state: appendCommandLogEntry(
          state,
          skipCookieOnPlay(
            state,
            playerId,
            state.pendingOnPlay.sourceInstanceId,
          ),
          {
            kind: 'skip-on-play',
            playerId,
            sourceInstanceId: state.pendingOnPlay.sourceInstanceId,
          },
        ),
        action: 'idle',
        description: `${state.players[playerId].name}未發動登場效果。`,
      }
    )
  }

  if (
    state.pendingRefresh ||
    state.pendingReplacement ||
    state.activePlayerId !== playerId
  ) {
    return {
      state,
      action: 'idle',
      description: `${state.players[playerId].name}等待行動。`,
    }
  }

  if (state.phase === 'active' || state.phase === 'draw') {
    return {
      state: appendCommandLogEntry(
        state,
        advancePhase(state),
        { kind: 'advance-phase', playerId },
      ),
      action: 'advance-phase',
      description: `${state.players[playerId].name}推進回合階段。`,
    }
  }

  const player = state.players[playerId]
  if (state.phase === 'support') {
    if (!state.supportPlacedThisTurn && player.hand.length > 0) {
      // 評估哪張手牌最適合放到支援區
      // 優先放非餅乾卡（物品、陷阱、階段），再考慮能量需求
      const nonCookieCards = player.hand.filter((card) => card.type !== 'cookie')
      let supportCard: GameCard

      if (nonCookieCards.length > 0) {
        // 計算目前支援區每種能量的數量
        const energyCount: Record<string, number> = {}
        for (const s of player.supportArea) {
          const color = s.card.energyColor ?? 'wild'
          energyCount[color] = (energyCount[color] || 0) + 1
        }

        // 找出手牌中能量顏色最稀缺的非餅乾卡
        supportCard = nonCookieCards.sort((a, b) => {
          const aColor = a.energyColor ?? 'wild'
          const bColor = b.energyColor ?? 'wild'
          const aCount = energyCount[aColor] ?? 0
          const bCount = energyCount[bColor] ?? 0
          return aCount - bCount // 稀缺的排前面
        })[0]
      } else {
        supportCard = player.hand[0]
      }

      return {
        state: appendCommandLogEntry(
          state,
          placeSupportCard(state, supportCard.instanceId),
          { kind: 'place-support', playerId, instanceId: supportCard.instanceId },
        ),
        action: 'place-support',
        description: `${player.name}將${supportCard.name}配置到支援區。`,
      }
    }
    return {
      state: appendCommandLogEntry(
        state,
        advancePhase(state),
        { kind: 'advance-phase', playerId },
      ),
      action: 'advance-phase',
      description: `${player.name}進入主要階段。`,
    }
  }

  if (state.phase === 'main') {
    const stageCard = !canAttack(state)
      ? player.hand.find((card) => card.type === 'stage' && card.stageAbility)
      : undefined
    if (stageCard?.stageAbility) {
      const paymentIds = selectEnergyPayment(
        stageCard.stageAbility.placementCost,
        player.supportArea,
      )
      if (paymentIds) {
        return {
          state: appendCommandLogEntry(
            state,
            playStage(state, playerId, stageCard.instanceId, paymentIds),
            {
              kind: 'play-stage',
              playerId,
              instanceId: stageCard.instanceId,
              paymentIds,
            },
          ),
          action: 'play-stage',
          description: `${player.name}放置${stageCard.name}。`,
        }
      }
    }

    if (!canAttack(state) && canActivateStage(state, playerId)) {
      const stage = player.stage!
      const ability = stage.card.stageAbility!
      const paymentIds = selectEnergyPayment(
        ability.cost.energy ?? ability.cost,
        player.supportArea,
      )
      if (paymentIds) {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: stage.card.instanceId,
        }
        let nextState = activateStage(state, playerId, paymentIds)
        for (const effect of ability.effects) {
          const targetIds = strategy.chooseEffectTargets(
            nextState,
            context,
            effect,
          )
          if (
            (effect.kind === 'support-to-hand' ||
              effect.kind === 'support-to-trash' ||
              effect.kind === 'trash-to-support') &&
            targetIds.length < effect.amount
          ) {
            break
          }
          nextState = executeCardEffect(
            nextState,
            context,
            effect,
            targetIds,
          )
          if (nextState.pendingRefresh) break
        }
        return {
          state: appendCommandLogEntry(
            state,
            finalizePendingReplacements(nextState),
            { kind: 'activate-stage', playerId, paymentIds },
          ),
          action: 'activate-stage',
          description: `${player.name}啟動${stage.card.name}。`,
        }
      }
    }

    for (const card of player.hand) {
      const itemDecision = strategy.resolveCardAbility(
        state,
        playerId,
        card,
      )
      if (itemDecision) return itemDecision
    }

    if (player.battleArea.length < 2) {
      const profile = getMatchupProfile(state, playerId)
      const handQuality = evaluateHandQuality(player.hand, profile)

      // 只有手牌品質足夠時才部署
      if (handQuality >= 30) {
        const deployable = chooseBestCookieToDeploy(player.hand, profile)
        if (deployable) {
          const deployedState = appendCommandLogEntry(
            state,
            deployCookie(state, deployable.instanceId),
            { kind: 'deploy-cookie', playerId, instanceId: deployable.instanceId },
          )
          const deployed = deployedState.players[playerId].battleArea.find(
            (cookie) => cookie.card.instanceId === deployable.instanceId,
          )
          const onPlay = deployed
            ? strategy.resolveSkill(
                deployedState,
                playerId,
                deployed,
                'on-play',
              )
            : null
          return {
            state:
              onPlay?.state ??
              (deployedState.pendingOnPlay
                ? appendCommandLogEntry(
                    deployedState,
                    skipCookieOnPlay(
                      deployedState,
                      playerId,
                      deployable.instanceId,
                    ),
                    {
                      kind: 'skip-on-play',
                      playerId,
                      sourceInstanceId: deployable.instanceId,
                    },
                  )
                : deployedState),
            action: 'deploy-cookie',
            description: onPlay
              ? `${player.name}讓${deployable.name}登場並發動 OnPlay。`
              : `${player.name}讓${deployable.name}登場。`,
            effectSelections: onPlay?.effectSelections,
          }
        }
      }
    }

    for (const source of player.battleArea) {
      const skillDecision = strategy.resolveSkill(
        state,
        playerId,
        source,
        'activate',
      )
      if (skillDecision) return skillDecision
    }

    if (canAttack(state)) {
      const target = strategy.chooseAttackTarget(state, playerId)
      if (target) {
        // 選擇最適合攻擊此目標的餅乾（優先選能一擊擊殺的）
        const eligibleAttackers = player.battleArea.filter((attacker) => {
          if (attacker.rested) return false
          if (
            state.attackDisabledUntilTurn?.[attacker.card.instanceId] ===
            state.turnNumber
          )
            return false
          const paymentIds = selectEnergyPayment(
            getAttackEnergyCost(attacker.card),
            player.supportArea,
          )
          return !!paymentIds
        })

        if (eligibleAttackers.length > 0) {
          // 按攻擊力排序，優先選能一擊擊殺的
          const sortedAttackers = [...eligibleAttackers].sort((a, b) => {
            const aCanKill = (a.card.attack ?? 0) >= target.hpCards.length
            const bCanKill = (b.card.attack ?? 0) >= target.hpCards.length
            if (aCanKill && !bCanKill) return -1
            if (!aCanKill && bCanKill) return 1
            return (b.card.attack ?? 0) - (a.card.attack ?? 0)
          })

          for (const attacker of sortedAttackers) {
            const paymentIds = selectEnergyPayment(
              getAttackEnergyCost(attacker.card),
              player.supportArea,
            )
            if (paymentIds) {
              return {
                state: appendCommandLogEntry(
                  state,
                  beginAttack(
                    state,
                    attacker.card.instanceId,
                    target.card.instanceId,
                    paymentIds,
                  ),
                  {
                    kind: 'attack',
                    playerId,
                    attackerInstanceId: attacker.card.instanceId,
                    targetInstanceId: target.card.instanceId,
                    supportPaymentIds: paymentIds,
                  },
                ),
                action: 'attack',
                description: `${player.name}以${attacker.card.name}攻擊${target.card.name}。`,
              }
            }
          }
        }
      }
    }

    return {
      state: appendCommandLogEntry(
        state,
        advancePhase(state),
        { kind: 'advance-phase', playerId },
      ),
      action: 'advance-phase',
      description: `${player.name}結束主要階段。`,
    }
  }

  if (state.phase === 'end') {
    const advanced = advancePhase(state)
    if (advanced.phase === 'end' && advanced.activePlayerId === state.activePlayerId) {
      return {
        state,
        action: 'idle',
        description: `${player.name}等待結算結束階段效果。`,
      }
    }
    return {
      state: appendCommandLogEntry(
        state,
        advanced,
        { kind: 'advance-phase', playerId },
      ),
      action: 'advance-phase',
      description: `${player.name}結束回合。`,
    }
  }

  return {
    state: appendCommandLogEntry(
      state,
      advancePhase(state),
      { kind: 'advance-phase', playerId },
    ),
    action: 'advance-phase',
    description: `${player.name}結束回合。`,
  }
}
