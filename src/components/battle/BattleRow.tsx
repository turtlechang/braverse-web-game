import { Layers3, Heart, Swords } from 'lucide-react'
import {
  canActivateCookieSkill,
  canActivateStage,
  canAttack,
  canPlayItem,
  canPlayStage,
  getAttackEnergyCost,
  getBreakAreaLevel,
  getEffectiveAttack,
  getEnergyCostTotal,
  selectEnergyPayment,
  type GameState,
  type PlayerId,
} from '../../game'
import { CardFace } from '../cards/CardVisuals'
import { computeOpponentFan } from './opponentFan'
import { computePlayerHandFan } from './playerHandFan'
import './BattleRow.css'

export type BattleResourceKind = 'deck' | 'stage' | 'break'

export interface BattleRowProps {
  game: GameState
  playerId: PlayerId
  position: 'top' | 'bottom'
  selectedAttackerId: string | null
  attackTargetingActive?: boolean
  effectTargetIds: Set<string>
  breakEffectTargetIds: Set<string>
  selectedEffectTargetIds: Set<string>
  selectedSkillPaymentIds: Set<string>
  skillPaymentTargetIds?: Set<string>
  skillCostSupportTargetIds?: Set<string>
  selectedSkillCostSupportIds?: Set<string>
  selectedSkillTrashBattleCookieIds?: Set<string>
  skillTrashBattleCookieTargetIds?: Set<string>
  selectedAttackPaymentIds: Set<string>
  attackPaymentTargetIds?: Set<string>
  selectedTrapPaymentIds?: Set<string>
  trapPaymentTargetIds?: Set<string>
  onTrapPayment?: (instanceId: string) => void
  attackPaymentValid: boolean
  interactionLocked: boolean
  selectedHandCardId?: string | null
  openResourceKind?: BattleResourceKind | null
  attackShakeId?: string | null
  damageFlashId?: string | null
  faintAnimIds?: Set<string>
  drawAnimIds?: Set<string>
  onSelectAttacker?: (instanceId: string) => void
  onAttackTarget?: (instanceId: string) => void
  onEffectTarget?: (instanceId: string) => void
  onSkillPayment?: (instanceId: string) => void
  onSkillCostSupport?: (instanceId: string) => void
  onSkillTrashBattleCookie?: (instanceId: string) => void
  onAttackPayment?: (instanceId: string) => void
  onActivateSkill?: (instanceId: string) => void
  onPlaceSupport?: (instanceId: string) => void
  onDeployCookie?: (instanceId: string) => void
  onPlayItem?: (instanceId: string) => void
  onPlayStage?: (instanceId: string) => void
  onActivateStage?: () => void
  onSelectHandCard?: (instanceId: string | null) => void
  onToggleResource?: (kind: BattleResourceKind) => void
  onInspectCard: (card: import('../../game').GameCard) => void
  onInspectDiscard: (playerId: PlayerId) => void
  onHoverCard?: (card: import('../../game').GameCard | null) => void
  onFocusCard?: (card: import('../../game').GameCard | null) => void
}

export function BattleRow({
  game,
  playerId,
  position,
  selectedAttackerId,
  attackTargetingActive = false,
  effectTargetIds,
  breakEffectTargetIds,
  selectedEffectTargetIds,
  selectedSkillPaymentIds,
  skillPaymentTargetIds = new Set<string>(),
  skillCostSupportTargetIds = new Set<string>(),
  selectedSkillCostSupportIds = new Set<string>(),
  selectedSkillTrashBattleCookieIds = new Set<string>(),
  skillTrashBattleCookieTargetIds = new Set<string>(),
  selectedAttackPaymentIds,
  attackPaymentTargetIds = new Set<string>(),
  selectedTrapPaymentIds = new Set<string>(),
  trapPaymentTargetIds = new Set<string>(),
  onTrapPayment,
  attackPaymentValid,
  interactionLocked,
  selectedHandCardId = null,
  openResourceKind = null,
  attackShakeId,
  damageFlashId,
  faintAnimIds,
  drawAnimIds,
  onSelectAttacker,
  onAttackTarget,
  onEffectTarget,
  onSkillPayment,
  onSkillCostSupport,
  onSkillTrashBattleCookie,
  onAttackPayment,
  onActivateSkill,
  onPlaceSupport,
  onDeployCookie,
  onPlayItem,
  onPlayStage,
  onActivateStage,
  onSelectHandCard,
  onToggleResource,
  onInspectCard,
  onInspectDiscard,
  onHoverCard,
  onFocusCard,
}: BattleRowProps) {
  const player = game.players[playerId]
  const isActivePlayer = game.activePlayerId === playerId
  const isOpponent = position === 'top'
  const canOperate = isActivePlayer && !isOpponent && !interactionLocked
  const toggleResource = (kind: BattleResourceKind) =>
    onToggleResource?.(kind)
  const supportZone = (
    <div className="support-zone">
      <span className="zone-watermark">支援區</span>
      <strong className="support-count">支援 {player.supportArea.length} 張</strong>
      <div className="support-cards">
        {player.supportArea.map((support, supportIndex) => {
          const supportId = support.card.instanceId
          const canSelectSkillCost =
            skillCostSupportTargetIds.has(supportId)
          const canSelectSkillPayment =
            skillPaymentTargetIds.has(supportId)
          const canSelectTrapPayment =
            trapPaymentTargetIds.has(supportId)
          const selectedForSkillCost =
            selectedSkillCostSupportIds.has(supportId)

          return (
            <div
              key={supportId}
              className="support-card-wrap"
              data-card-instance-id={supportId}
              style={{ '--support-index': isOpponent ? player.supportArea.length - 1 - supportIndex : supportIndex } as React.CSSProperties}
              onMouseEnter={() => onHoverCard?.(support.card)}
              onMouseLeave={() => onHoverCard?.(null)}
              onFocus={() => onFocusCard?.(support.card)}
              onBlur={() => onFocusCard?.(null)}
            >
              <CardFace
                card={support.card}
                className="support-card"
                rested={
                  support.rested ||
                  selectedSkillPaymentIds.has(supportId) ||
                  selectedAttackPaymentIds.has(supportId) ||
                  selectedTrapPaymentIds.has(supportId)
                }
                selected={
                  selectedForSkillCost ||
                  selectedSkillPaymentIds.has(supportId) ||
                  selectedAttackPaymentIds.has(supportId) ||
                  selectedTrapPaymentIds.has(supportId)
                }
                targetable={
                canSelectSkillCost ||
                canSelectSkillPayment ||
                canSelectTrapPayment ||
                (canOperate &&
                  Boolean(selectedAttackerId) &&
                  !support.rested &&
                  Boolean(onAttackPayment) &&
                  attackPaymentTargetIds.has(supportId))
              }
              ariaLabel={
                canSelectSkillCost
                  ? `選擇${support.card.name}作為技能代價`
                  : canSelectSkillPayment
                    ? `選擇${support.card.name}支付技能能量`
                  : canSelectTrapPayment
                    ? `選擇${support.card.name}支付陷阱能量`
                  : undefined
              }
              onClick={
                canSelectSkillPayment && onSkillPayment
                  ? () => onSkillPayment(supportId)
                  : canSelectSkillCost && onSkillCostSupport
                    ? () => onSkillCostSupport(supportId)
                    : canSelectTrapPayment && onTrapPayment
                      ? () => onTrapPayment(supportId)
                      : canOperate &&
                          selectedAttackerId &&
                          !support.rested &&
                          attackPaymentTargetIds.has(supportId) &&
                          onAttackPayment
                        ? () => onAttackPayment(supportId)
                        : () => onInspectCard(support.card)
              }
            />
            </div>
          )
        })}
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
      <div className="break-zone resource-dock">
        <div className="zone-heading">
          <span>休息</span>
          <b>×{player.breakArea.length}</b>
          <strong>LV. {getBreakAreaLevel(game, playerId)}</strong>
        </div>
        <button
          className="resource-summary break-summary"
          type="button"
          aria-label={`${player.name}休息區摘要`}
          aria-expanded={openResourceKind === 'break'}
          title={`休息區 LV.${getBreakAreaLevel(game, playerId)} · ${player.breakArea.length} 張`}
          onClick={() => toggleResource('break')}
        >
          <div className="mini-break-stack" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </button>
        <div className="break-cards">
          {player.breakArea.map((card) => {
            const canSelectBreakEffectTarget = breakEffectTargetIds.has(
              card.instanceId,
            )
            return (
              <div
                className="break-card-wrap"
                key={card.instanceId}
                onMouseEnter={() => onHoverCard?.(card)}
                onMouseLeave={() => onHoverCard?.(null)}
                onFocus={() => onFocusCard?.(card)}
                onBlur={() => onFocusCard?.(null)}
              >
                <CardFace
                  card={card}
                  className="break-card"
                  selected={selectedEffectTargetIds.has(card.instanceId)}
                  targetable={canSelectBreakEffectTarget}
                  onClick={
                    canSelectBreakEffectTarget
                      ? () => onEffectTarget?.(card.instanceId)
                      : () => toggleResource('break')
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
        {openResourceKind === 'break' && (
          <div
            className="resource-popover break-popover"
            role="dialog"
            aria-label={`${player.name}休息區資訊`}
          >
            <span>{player.name}休息區</span>
            <strong>
              LV. {getBreakAreaLevel(game, playerId)} · {player.breakArea.length} 張
            </strong>
            {player.breakArea.length > 0 ? (
              <div className="resource-card-list">
                {player.breakArea.map((card) => (
                  <button
                    type="button"
                    key={card.instanceId}
                    onClick={() => onInspectCard(card)}
                  >
                    <CardFace card={card} className="resource-card" />
                    <small>{card.name}</small>
                  </button>
                ))}
              </div>
            ) : (
              <small>目前沒有卡牌。</small>
            )}
          </div>
        )}
      </div>

      <div className="field-stack">
        {position === 'top' && supportZone}
        {isOpponent && player.hand.length > 0 && (() => {
          const baseFan = computeOpponentFan(player.hand.length, 0)
          return (
            <div
              className="hand-fan top-hand"
              aria-label="對手手牌"
              style={{ '--safety-ratio': baseFan.safetyRatio } as React.CSSProperties}
            >
              {player.hand.map((card, index) => {
                const fan = computeOpponentFan(player.hand.length, index)
                return (
                  <div
                    className={`hand-card-wrap opponent-hand-card${player.hand.length === 1 ? ' single-card' : ''}`}
                    key={card.instanceId}
                    style={{
                      '--opponent-angle': `${fan.opponentAngle}deg`,
                      '--opponent-x': `${fan.opponentX}px`,
                      '--fan-z-index': fan.fanZIndex,
                    } as React.CSSProperties}
                  >
                    <CardFace
                      card={card}
                      className="hand-card opponent-oriented-card"
                      concealed
                    />
                  </div>
                )
              })}
            </div>
          )
        })()}
        <div
          className="row-meta"
          data-active={isActivePlayer ? 'true' : 'false'}
        >
          <span className="row-avatar" aria-hidden="true">
            {player.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div className="row-meta-info">
            <span className="row-role">{isOpponent ? 'OPPONENT' : 'PLAYER'}</span>
            <strong>{player.name}</strong>
            <b className="turn-order-badge">
              {game.firstPlayerId === playerId ? '先攻' : '後攻'}
            </b>
            <div
              className="row-status"
              data-active={isActivePlayer ? 'true' : 'false'}
              aria-label={`${player.name}狀態：${isActivePlayer ? '行動中' : '等待'}，手牌 ${player.hand.length}`}
            >
              <span
                className={`row-stat row-stat-status ${isActivePlayer ? 'is-active' : 'is-waiting'}`}
                data-active={isActivePlayer ? 'true' : 'false'}
              >
                {isActivePlayer ? '行動中' : '等待'}
              </span>
              <span className="row-stat row-stat-hand" aria-label={`手牌 ${player.hand.length}`}>
                <span className="row-stat-label">手牌</span>
                <b className="row-stat-value">{player.hand.length}</b>
              </span>
            </div>
          </div>
        </div>
        <div className="combat-zone">
          <span className="zone-watermark">戰鬥區</span>
          <div className="combat-slots">
            {player.battleArea.map((cookie) => {
              const canSelectEffectTarget = effectTargetIds.has(
                cookie.card.instanceId,
              )
              const attackEligibleExceptEnergy =
                canOperate &&
                game.phase === 'main' &&
                canAttack(game) &&
                !cookie.rested
              const attackEnergyCost = getAttackEnergyCost(cookie.card)
              const canAffordAttack =
                selectEnergyPayment(attackEnergyCost, player.supportArea) !==
                null
              const canSelectAttack =
                attackEligibleExceptEnergy && canAffordAttack
              const showEnergyShortfallHint =
                attackEligibleExceptEnergy && !canAffordAttack
              const availableEnergyCount = player.supportArea.filter(
                (support) => !support.rested,
              ).length
              const canTarget =
                !interactionLocked &&
                isOpponent &&
                attackTargetingActive &&
                attackPaymentValid
              const canActivateSkill =
                canOperate &&
                canActivateCookieSkill(
                  game,
                  playerId,
                  cookie.card.instanceId,
                  'activate',
                )
              const revealTargetId =
                game.pendingBattle?.damageTargetInstanceId ??
                game.pendingBattle?.targetInstanceId
              const revealedHpCard =
                game.pendingBattle &&
                (game.pendingBattle.stage === 'damage' ||
                  game.pendingBattle.stage === 'flip') &&
                revealTargetId === cookie.card.instanceId
                  ? game.pendingBattle.revealedHpCard
                  : null

              const animClasses = [
                faintAnimIds?.has(cookie.card.instanceId) && 'animate-faint-shrink',
                attackShakeId === cookie.card.instanceId && 'animate-attack-shake',
                damageFlashId === cookie.card.instanceId && 'animate-damage-flash',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div
                  className={`combat-card-wrap ${animClasses}`}
                  key={cookie.card.instanceId}
                  data-card-instance-id={cookie.card.instanceId}
                  onMouseEnter={() => onHoverCard?.(cookie.card)}
                  onMouseLeave={() => onHoverCard?.(null)}
                  onFocus={() => onFocusCard?.(cookie.card)}
                  onBlur={() => onFocusCard?.(null)}
                >
                  <CardFace
                    card={cookie.card}
                    rested={cookie.rested}
                    selected={
                      selectedAttackerId === cookie.card.instanceId ||
                      selectedEffectTargetIds.has(cookie.card.instanceId) ||
                      selectedSkillTrashBattleCookieIds.has(cookie.card.instanceId)
                    }
                    targetable={
                      canSelectEffectTarget ||
                      skillTrashBattleCookieTargetIds.has(
                        cookie.card.instanceId,
                      )
                    }
                    attackable={canSelectAttack}
                    onClick={
                      canSelectEffectTarget
                        ? () => onEffectTarget?.(cookie.card.instanceId)
                        : skillTrashBattleCookieTargetIds.has(cookie.card.instanceId)
                          ? () => onSkillTrashBattleCookie?.(cookie.card.instanceId)
                        : canTarget
                        ? () => onAttackTarget?.(cookie.card.instanceId)
                        : canSelectAttack
                          ? () => onSelectAttacker?.(cookie.card.instanceId)
                          : () => onInspectCard(cookie.card)
                    }
                  />
                  <div className="card-badges">
                    <span className="badge-hp"><Heart size={12} aria-hidden="true" /> {cookie.hpCards.length}/{cookie.card.hp}</span>
                    <span className="badge-atk">
                      <Swords size={12} aria-hidden="true" /> {getEffectiveAttack(game, cookie.card.instanceId)}
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
                  {revealedHpCard && (
                    <div className="hp-reveal-indicator" aria-live="polite">
                      <CardFace
                        card={revealedHpCard}
                        className="hp-reveal-card"
                        key={revealedHpCard.instanceId}
                        onClick={() => onInspectCard(cookie.card)}
                      />
                      {revealedHpCard.flip && (
                        <span className="hp-reveal-flip-badge">FLIP</span>
                      )}
                    </div>
                  )}
                  {(canTarget || canSelectEffectTarget) && (
                    <span className="target-hint">
                      {canSelectEffectTarget ? '效果目標' : '攻擊目標'}
                    </span>
                  )}
                  {showEnergyShortfallHint && (
                    <span className="energy-shortfall-hint">
                      能量不足：需要 {getEnergyCostTotal(attackEnergyCost)}，
                      目前可用 {availableEnergyCount}
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
        <div className="deck-zone resource-dock">
          <button
            className="resource-summary"
            type="button"
            aria-label={`${player.name}牌庫 ${player.deck.length} 張`}
            aria-expanded={openResourceKind === 'deck'}
            title={`牌庫剩餘 ${player.deck.length} 張`}
            onClick={() => toggleResource('deck')}
          >
            <div className="mini-deck" />
            <strong>{player.deck.length}</strong>
            <span>牌庫</span>
          </button>
          {openResourceKind === 'deck' && (
            <div
              className="resource-popover"
              role="dialog"
              aria-label={`${player.name}牌庫資訊`}
            >
              <span>{player.name}牌庫</span>
              <strong>牌庫剩餘 {player.deck.length} 張</strong>
              <small>牌庫內容在對局中保持隱藏。</small>
            </div>
          )}
        </div>
        <div className="stage-zone resource-dock">
          <button
            className="resource-summary"
            type="button"
            aria-label={`${player.name}場景區`}
            aria-expanded={openResourceKind === 'stage'}
            title={player.stage ? `${player.stage.card.name} ${player.stage.rested ? '(已橫置)' : '(活躍)'}` : '場景區空'}
            onClick={() => toggleResource('stage')}
            onMouseEnter={() => player.stage && onHoverCard?.(player.stage.card)}
            onMouseLeave={() => onHoverCard?.(null)}
            onFocus={() => player.stage && onFocusCard?.(player.stage.card)}
            onBlur={() => onFocusCard?.(null)}
          >
            {player.stage ? (
              <CardFace
                card={player.stage.card}
                className="stage-card"
                rested={player.stage.rested}
              />
            ) : (
              <Layers3 aria-hidden="true" />
            )}
            <span>場景</span>
          </button>
          {canOperate && canActivateStage(game, playerId) && (
            <button
              className="stage-quick-action"
              type="button"
              onClick={() => onActivateStage?.()}
            >
              啟動
            </button>
          )}
          {openResourceKind === 'stage' && (
            <div
              className="resource-popover"
              role="dialog"
              aria-label={`${player.name}場景區資訊`}
            >
              <span>{player.name}場景區</span>
              {player.stage ? (
                <>
                  <strong>{player.stage.card.name}</strong>
                  <small>
                    {player.stage.rested ? '目前已橫置' : '目前為活躍狀態'}
                  </small>
                  <button
                    className="resource-detail-button"
                    type="button"
                    onClick={() => onInspectCard(player.stage!.card)}
                  >
                    查看卡牌詳情
                  </button>
                </>
              ) : (
                <small>目前沒有場景卡。</small>
              )}
            </div>
          )}
        </div>
        <button
          className="discard-zone resource-summary"
          type="button"
          disabled={player.discardPile.length === 0}
          title={`棄牌區 ${player.discardPile.length} 張`}
          onClick={() => onInspectDiscard(playerId)}
          onMouseEnter={() => {
            const topCard = player.discardPile[player.discardPile.length - 1]
            if (topCard) onHoverCard?.(topCard)
          }}
          onMouseLeave={() => onHoverCard?.(null)}
          onFocus={() => {
            const topCard = player.discardPile[player.discardPile.length - 1]
            if (topCard) onFocusCard?.(topCard)
          }}
          onBlur={() => onFocusCard?.(null)}
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

      {!isOpponent && (
        <div
          className="hand-fan bottom-hand"
          aria-label="我方手牌"
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
              canOperate &&
              canPlayItem(game, playerId, card.instanceId) &&
              Boolean(
                card.item &&
                  selectEnergyPayment(
                    card.item.cost.energy ?? card.item.cost,
                    player.supportArea,
                  ),
              )
            const canPlaceStage =
              canOperate &&
              canPlayStage(game, playerId, card.instanceId) &&
              Boolean(
                card.stageAbility &&
                  selectEnergyPayment(
                    card.stageAbility.placementCost,
                    player.supportArea,
                  ),
              )
            const actionLabel = canDeploy
              ? '登場'
              : canUseItem
                ? '使用'
                : canPlaceStage
                  ? '放置'
                  : canSupport
                    ? '支援'
                    : null
            const isSelected = selectedHandCardId === card.instanceId
            const count = player.hand.length
            const { fanX, fanY, fanRotation } = computePlayerHandFan(count, index)

            return (
              <div
                className={`hand-card-wrap${isSelected ? ' is-selected' : ''}${actionLabel ? ' is-actionable' : ''} ${drawAnimIds?.has(card.instanceId) ? 'animate-draw-slide-up' : ''}`}
                key={card.instanceId}
                style={{
                  '--fan-index': index,
                  '--fan-x': `${fanX}px`,
                  '--fan-y': `${fanY}px`,
                  '--fan-rotation': `${fanRotation}deg`,
                } as React.CSSProperties}
                onMouseEnter={() => onHoverCard?.(card)}
                onMouseLeave={() => onHoverCard?.(null)}
                onFocus={() => onFocusCard?.(card)}
                onBlur={() => onFocusCard?.(null)}
              >
                <CardFace
                  card={card}
                  className="hand-card"
                  ariaPressed={isSelected}
                  onClick={
                    actionLabel && onSelectHandCard
                      ? () => onSelectHandCard(card.instanceId)
                      : () => onInspectCard(card)
                  }
                />
                {isSelected && actionLabel && (
                  <div className="hand-card-actions">
                    <button
                      className="hand-card-action"
                      type="button"
                      onClick={() => {
                        onSelectHandCard?.(null)
                        if (canDeploy) onDeployCookie?.(card.instanceId)
                        else if (canUseItem) onPlayItem?.(card.instanceId)
                        else if (canPlaceStage) onPlayStage?.(card.instanceId)
                        else onPlaceSupport?.(card.instanceId)
                      }}
                    >
                      {actionLabel}
                    </button>
                    <button
                      className="hand-card-detail"
                      type="button"
                      onClick={() => onInspectCard(card)}
                    >
                      詳情
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
