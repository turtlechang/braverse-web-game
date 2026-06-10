import { Layers3 } from 'lucide-react'
import {
  canActivateCookieSkill,
  canActivateStage,
  canAttack,
  getAttackEnergyCost,
  getBreakAreaLevel,
  getEffectiveAttack,
  selectEnergyPayment,
  type GameState,
  type PlayerId,
} from '../../game'
import { CardFace } from '../cards/CardVisuals'
import './BattleRow.css'

export interface BattleRowProps {
  game: GameState
  playerId: PlayerId
  position: 'top' | 'bottom'
  selectedAttackerId: string | null
  effectTargetIds: Set<string>
  breakEffectTargetIds: Set<string>
  selectedEffectTargetIds: Set<string>
  selectedSkillPaymentIds: Set<string>
  selectedAttackPaymentIds: Set<string>
  attackPaymentValid: boolean
  interactionLocked: boolean
  onSelectAttacker?: (instanceId: string) => void
  onAttackTarget?: (instanceId: string) => void
  onEffectTarget?: (instanceId: string) => void
  onSkillPayment?: (instanceId: string) => void
  onAttackPayment?: (instanceId: string) => void
  onActivateSkill?: (instanceId: string) => void
  onPlaceSupport?: (instanceId: string) => void
  onDeployCookie?: (instanceId: string) => void
  onPlayItem?: (instanceId: string) => void
  onPlayStage?: (instanceId: string) => void
  onActivateStage?: () => void
  onInspectCard: (card: import('../../game').GameCard) => void
  onInspectDiscard: (playerId: PlayerId) => void
}

export function BattleRow({
  game,
  playerId,
  position,
  selectedAttackerId,
  effectTargetIds,
  breakEffectTargetIds,
  selectedEffectTargetIds,
  selectedSkillPaymentIds,
  selectedAttackPaymentIds,
  attackPaymentValid,
  interactionLocked,
  onSelectAttacker,
  onAttackTarget,
  onEffectTarget,
  onSkillPayment,
  onAttackPayment,
  onActivateSkill,
  onPlaceSupport,
  onDeployCookie,
  onPlayItem,
  onPlayStage,
  onActivateStage,
  onInspectCard,
  onInspectDiscard,
}: BattleRowProps) {
  const player = game.players[playerId]
  const isActivePlayer = game.activePlayerId === playerId
  const isOpponent = position === 'top'
  const canOperate = isActivePlayer && !isOpponent && !interactionLocked
  const supportZone = (
    <div className="support-zone">
      <span className="zone-watermark">支援區</span>
      <div className="support-cards">
        {player.supportArea.map((support) => (
          <CardFace
            card={support.card}
            className="support-card"
            rested={
              support.rested ||
              selectedSkillPaymentIds.has(support.card.instanceId) ||
              selectedAttackPaymentIds.has(support.card.instanceId)
            }
            selected={
              selectedSkillPaymentIds.has(support.card.instanceId) ||
              selectedAttackPaymentIds.has(support.card.instanceId)
            }
            targetable={
              interactionLocked &&
              !support.rested &&
              Boolean(onSkillPayment)
                ? true
                : canOperate &&
                  Boolean(selectedAttackerId) &&
                  !support.rested &&
                  Boolean(onAttackPayment)
            }
            key={support.card.instanceId}
            onClick={
              interactionLocked && !support.rested && onSkillPayment
                ? () => onSkillPayment(support.card.instanceId)
                : canOperate &&
                    selectedAttackerId &&
                    !support.rested &&
                    onAttackPayment
                  ? () => onAttackPayment(support.card.instanceId)
                : () => onInspectCard(support.card)
            }
          />
        ))}
        {player.supportArea.length === 0 && (
          <span className="empty-zone">尚未配置支援</span>
        )}
      </div>
    </div>
  )

  return (
    <section
      className={`battle-row ${position}-field`}
      aria-label={`${player.name}場地`}
    >
      <div className="break-zone">
        <div className="zone-heading">
          <span>休息區</span>
          <strong>LV. {getBreakAreaLevel(game, playerId)}</strong>
        </div>
        <div className="break-cards">
          {player.breakArea.map((card) => {
            const canSelectBreakEffectTarget = breakEffectTargetIds.has(
              card.instanceId,
            )
            return (
              <div className="break-card-wrap" key={card.instanceId}>
                <CardFace
                  card={card}
                  className="break-card"
                  selected={selectedEffectTargetIds.has(card.instanceId)}
                  targetable={canSelectBreakEffectTarget}
                  onClick={
                    canSelectBreakEffectTarget
                      ? () => onEffectTarget?.(card.instanceId)
                      : () => onInspectCard(card)
                  }
                />
                {canSelectBreakEffectTarget && (
                  <span className="target-hint">效果目標</span>
                )}
              </div>
            )
          })}
          {player.breakArea.length === 0 && (
            <small className="empty-zone">0 張</small>
          )}
        </div>
      </div>

      <div className="field-stack">
        {position === 'top' && supportZone}
        <div className="combat-zone">
          <div className="row-meta">
            <span>{isOpponent ? 'OPPONENT' : 'PLAYER'}</span>
            <strong>{player.name}</strong>
            <small>
              {isActivePlayer ? '行動中' : '等待'} · 手牌 {player.hand.length}
            </small>
          </div>
          <span className="zone-watermark">戰鬥區</span>
          <div className="combat-slots">
            {player.battleArea.map((cookie) => {
              const canSelectEffectTarget = effectTargetIds.has(
                cookie.card.instanceId,
              )
              const canSelectAttack =
                canOperate &&
                game.phase === 'main' &&
                canAttack(game) &&
                !cookie.rested &&
                selectEnergyPayment(
                  getAttackEnergyCost(cookie.card),
                  player.supportArea,
                ) !== null
              const canTarget =
                !interactionLocked &&
                isOpponent &&
                Boolean(selectedAttackerId) &&
                attackPaymentValid
              const canActivateSkill =
                canOperate &&
                canActivateCookieSkill(
                  game,
                  playerId,
                  cookie.card.instanceId,
                  'activate',
                )

              return (
                <div className="combat-card-wrap" key={cookie.card.instanceId}>
                  <CardFace
                    card={cookie.card}
                    rested={cookie.rested}
                    selected={
                      selectedAttackerId === cookie.card.instanceId ||
                      selectedEffectTargetIds.has(cookie.card.instanceId)
                    }
                    targetable={canSelectEffectTarget}
                    onClick={
                      canSelectEffectTarget
                        ? () => onEffectTarget?.(cookie.card.instanceId)
                        : canTarget
                        ? () => onAttackTarget?.(cookie.card.instanceId)
                        : canSelectAttack
                          ? () => onSelectAttacker?.(cookie.card.instanceId)
                          : () => onInspectCard(cookie.card)
                    }
                  />
                  <div className="card-badges">
                    <span>HP {cookie.hpCards.length}/{cookie.card.hp}</span>
                    <span>
                      ATK {getEffectiveAttack(game, cookie.card.instanceId)}
                    </span>
                  </div>
                  <div
                    className="hp-card-stack"
                    aria-label={`${cookie.card.name} HP 卡 ${cookie.hpCards.length} 張`}
                  >
                    {cookie.hpCards.map((hpCard) => (
                      <CardFace
                        card={hpCard}
                        className="hp-card"
                        concealed
                        key={hpCard.instanceId}
                        onClick={() => onInspectCard(cookie.card)}
                      />
                    ))}
                  </div>
                  {(canTarget || canSelectEffectTarget) && (
                    <span className="target-hint">
                      {canSelectEffectTarget ? '效果目標' : '攻擊目標'}
                    </span>
                  )}
                  {canActivateSkill && (
                    <button
                      className="skill-action"
                      type="button"
                      onClick={() =>
                        onActivateSkill?.(cookie.card.instanceId)
                      }
                    >
                      啟動技能
                    </button>
                  )}
                </div>
              )
            })}
            {player.battleArea.length === 0 && (
              <span className="empty-zone">等待餅乾登場</span>
            )}
          </div>
        </div>
        {position === 'bottom' && supportZone}
      </div>

      <div className="utility-zones">
        <div className="deck-zone" aria-label={`牌庫 ${player.deck.length} 張`}>
          <div className="mini-deck" />
          <strong>{player.deck.length}</strong>
          <span>牌庫</span>
        </div>
        <div className="stage-zone">
          <span>場景區</span>
          {player.stage ? (
            <>
              <CardFace
                card={player.stage.card}
                className="stage-card"
                rested={player.stage.rested}
                onClick={() => onInspectCard(player.stage!.card)}
              />
              {canOperate && canActivateStage(game, playerId) && (
                <button type="button" onClick={() => onActivateStage?.()}>
                  啟動
                </button>
              )}
            </>
          ) : (
            <Layers3 aria-hidden="true" />
          )}
        </div>
        <button
          className="discard-zone"
          type="button"
          disabled={player.discardPile.length === 0}
          onClick={() => onInspectDiscard(playerId)}
        >
          <span>棄牌區</span>
          {player.discardPile.length > 0 && (
            <div className="discard-card-stack">
              <i />
              <i />
              <CardFace
                card={player.discardPile[player.discardPile.length - 1]}
                className="discard-top-card"
              />
            </div>
          )}
          <strong>{player.discardPile.length}</strong>
        </button>
      </div>

      <div
        className={`hand-fan ${position}-hand`}
        aria-label={`${isOpponent ? '對手' : '我方'}手牌`}
      >
        {player.hand.map((card, index) => {
          const canSupport =
            canOperate &&
            game.phase === 'support' &&
            !game.supportPlacedThisTurn
          const canDeploy =
            canOperate &&
            game.phase === 'main' &&
            card.type === 'cookie' &&
            player.battleArea.length < 2
          const canUseItem =
            canOperate && game.phase === 'main' && card.type === 'item'
          const canPlaceStage =
            canOperate && game.phase === 'main' && card.type === 'stage'
          const offset = index - (player.hand.length - 1) / 2

          return (
            <div
              className="hand-card-wrap"
              key={card.instanceId}
              style={{
                '--fan-index': index,
                '--fan-offset': offset,
              } as React.CSSProperties}
            >
              <CardFace
                card={card}
                className="hand-card"
                concealed={isOpponent}
                onClick={
                  isOpponent ? undefined : () => onInspectCard(card)
                }
              />
              {(canSupport || canDeploy || canUseItem || canPlaceStage) && (
                <button
                  className="hand-card-action"
                  type="button"
                  onClick={() =>
                    canDeploy
                      ? onDeployCookie?.(card.instanceId)
                      : canUseItem
                        ? onPlayItem?.(card.instanceId)
                        : canPlaceStage
                          ? onPlayStage?.(card.instanceId)
                          : onPlaceSupport?.(card.instanceId)
                  }
                >
                  {canDeploy ? '登場' : canUseItem ? '使用' : canPlaceStage ? '放置' : '支援'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
