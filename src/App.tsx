import { useState } from 'react'
import {
  Check,
  ChevronRight,
  Eye,
  Layers3,
  Pause,
  RotateCcw,
  Sparkles,
  Swords,
  X,
} from 'lucide-react'
import './App.css'
import {
  activateCookieSkill,
  advancePhase,
  attackCookie,
  canActivateCookieSkill,
  canAttack,
  createDemoGame,
  deployCookie,
  executeCardEffect,
  getBreakAreaLevel,
  getEffectTargetCandidates,
  getEffectiveAttack,
  getRefreshCandidates,
  isEffectConditionMet,
  placeSupportCard,
  refreshDeck,
  replaceDefeatedCookie,
  type CardEffect,
  type CardSkill,
  type EffectContext,
  type GameCard,
  type GameState,
  type PlayerId,
  type SkillTrigger,
  type TurnPhase,
} from './game'

const phases: TurnPhase[] = ['active', 'draw', 'support', 'main', 'end']
const phaseLabels: Record<TurnPhase, string> = {
  active: '活躍階段',
  draw: '抽牌階段',
  support: '支援階段',
  main: '主要階段',
  end: '結束階段',
}
const nextPhaseLabels: Record<TurnPhase, string> = {
  active: '完成活躍',
  draw: '前往支援',
  support: '前往主要',
  main: '結束主要',
  end: '結束回合',
}

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

interface PendingEffect {
  sourceCard: GameCard
  context: EffectContext
  skill: CardSkill
  trigger: SkillTrigger
  effects: CardEffect[]
  effectIndex: number
  selectedTargetIds: string[]
  selectedPaymentIds: string[]
  skillActivated: boolean
  optional: boolean
  triggerLabel: string
}

const energyLabels = {
  red: '紅',
  yellow: '黃',
  green: '綠',
  blue: '藍',
  purple: '紫',
  black: '黑',
  neutral: '任意',
} as const

const getSkillCostTotal = (skill: CardSkill) =>
  Object.values(skill.cost).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

const describeSkillCost = (skill: CardSkill) => {
  const labels = Object.entries(skill.cost).flatMap(([energy, amount]) =>
    Array.from(
      { length: amount ?? 0 },
      () => energyLabels[energy as keyof typeof energyLabels],
    ),
  )

  return labels.length > 0 ? labels.join('、') : '不需能量'
}

const getSkillLabels = (skill: CardSkill) => [
  skill.trigger === 'activate'
    ? 'Activate 啟動'
    : skill.trigger === 'on-play'
      ? 'OnPlay 登場'
      : 'Skill 技能',
  ...(skill.oncePerTurn ? ['Once per turn 一回合一次'] : []),
  ...(skill.yourTurn ? ['Your Turn 自己的回合'] : []),
]

const describeEffect = (effect: CardEffect) => {
  const target =
    effect.target.side === 'self' ? '我方餅乾' : '對手餅乾'
  const count =
    effect.target.min === effect.target.max
      ? `${effect.target.max} 個`
      : `最多 ${effect.target.max} 個`

  if (effect.kind === 'damage') {
    return `選擇${count}${target}，造成 ${effect.amount} 點效果傷害。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `選擇${count}${target}，攻擊傷害 ${value}。`
    : `選擇${count}${target}，受到的攻擊傷害 ${value}。`
}

const describeEffectResult = (
  effect: CardEffect,
  targetNames: string[],
) => {
  if (targetNames.length === 0) {
    return '效果已確認，本次沒有選擇目標。'
  }

  const names = targetNames.join('、')
  if (effect.kind === 'damage') {
    return `${names}受到 ${effect.amount} 點效果傷害。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `${names}獲得攻擊傷害 ${value} 修正。`
    : `${names}獲得受到攻擊傷害 ${value} 修正。`
}

interface CardFaceProps {
  card: GameCard
  className?: string
  concealed?: boolean
  rested?: boolean
  selected?: boolean
  targetable?: boolean
  onClick?: () => void
}

function CardFace({
  card,
  className = '',
  concealed = false,
  rested = false,
  selected = false,
  targetable = false,
  onClick,
}: CardFaceProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const content = concealed ? (
    <div className="card-back">
      <span>COOKIE RUN</span>
      <strong>BRAVERSE</strong>
    </div>
  ) : card.imageUrl && !imageFailed ? (
    <img
      src={card.imageUrl}
      alt={card.name}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <div className="card-fallback">
      <span>{card.type.toUpperCase()}</span>
      <strong>{card.name}</strong>
      {card.type === 'cookie' && (
        <small>LV {card.level} · HP {card.hp}</small>
      )}
    </div>
  )

  if (!onClick) {
    return (
      <div
        className={`card-face ${className}${rested ? ' is-rested' : ''}${
          selected ? ' is-selected' : ''
        }${targetable ? ' is-targetable' : ''}`}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      className={`card-face ${className}${rested ? ' is-rested' : ''}${
        selected ? ' is-selected' : ''
      }${targetable ? ' is-targetable' : ''}`}
      type="button"
      title={card.name}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

interface BattleRowProps {
  game: GameState
  playerId: PlayerId
  position: 'top' | 'bottom'
  selectedAttackerId: string | null
  effectTargetIds: Set<string>
  selectedEffectTargetIds: Set<string>
  selectedSkillPaymentIds: Set<string>
  interactionLocked: boolean
  onSelectAttacker?: (instanceId: string) => void
  onAttackTarget?: (instanceId: string) => void
  onEffectTarget?: (instanceId: string) => void
  onSkillPayment?: (instanceId: string) => void
  onActivateSkill?: (instanceId: string) => void
  onPlaceSupport?: (instanceId: string) => void
  onDeployCookie?: (instanceId: string) => void
  onInspectCard: (card: GameCard) => void
}

function BattleRow({
  game,
  playerId,
  position,
  selectedAttackerId,
  effectTargetIds,
  selectedEffectTargetIds,
  selectedSkillPaymentIds,
  interactionLocked,
  onSelectAttacker,
  onAttackTarget,
  onEffectTarget,
  onSkillPayment,
  onActivateSkill,
  onPlaceSupport,
  onDeployCookie,
  onInspectCard,
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
            rested={support.rested}
            selected={selectedSkillPaymentIds.has(
              support.card.instanceId,
            )}
            targetable={
              interactionLocked &&
              !support.rested &&
              Boolean(onSkillPayment)
            }
            key={support.card.instanceId}
            onClick={
              interactionLocked && !support.rested && onSkillPayment
                ? () => onSkillPayment(support.card.instanceId)
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
          {player.breakArea.map((card) => (
            <CardFace
              card={card}
              className="break-card"
              key={card.instanceId}
              onClick={() => onInspectCard(card)}
            />
          ))}
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
                player.supportArea.filter((support) => !support.rested)
                  .length >= cookie.card.attackCost
              const canTarget =
                !interactionLocked &&
                isOpponent &&
                Boolean(selectedAttackerId)
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
            <CardFace
              card={player.stage}
              className="stage-card"
              onClick={() => onInspectCard(player.stage!)}
            />
          ) : (
            <Layers3 aria-hidden="true" />
          )}
        </div>
        <div className="discard-zone">
          <span>棄牌區</span>
          <strong>{player.discardPile.length}</strong>
        </div>
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
              {(canSupport || canDeploy) && (
                <button
                  className="hand-card-action"
                  type="button"
                  onClick={() =>
                    canDeploy
                      ? onDeployCookie?.(card.instanceId)
                      : onPlaceSupport?.(card.instanceId)
                  }
                >
                  {canDeploy ? '登場' : '支援'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function App() {
  const [game, setGame] = useState(createDemoGame)
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )
  const [message, setMessage] = useState('推進階段，開始這場對戰。')
  const [effectHistory, setEffectHistory] = useState<string[]>([])
  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [showPause, setShowPause] = useState(false)
  const activePlayer = game.players[game.activePlayerId]
  const viewerPlayerId: PlayerId = 'player-one'
  const opponentId = opponentOf(viewerPlayerId)
  const currentEffect =
    pendingEffect?.effects[pendingEffect.effectIndex] ?? null
  const effectTargetCandidates =
    pendingEffect && currentEffect
      ? getEffectTargetCandidates(
          game,
          pendingEffect.context,
          currentEffect.target,
        )
      : []
  const effectTargetIds = new Set(
    effectTargetCandidates.map((cookie) => cookie.card.instanceId),
  )
  const selectedEffectTargetIds = new Set(
    pendingEffect?.selectedTargetIds ?? [],
  )
  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )

  const beginCookieSkill = (
    nextGame: GameState,
    card: GameCard | undefined,
    playerId: PlayerId,
    trigger: SkillTrigger,
    triggerLabel: string,
    optional = false,
  ) => {
    if (
      !card?.skill ||
      card.skill.trigger !== trigger ||
      nextGame.status !== 'playing'
    ) {
      return
    }

    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: card.instanceId,
    }
    const availableEffects = card.skill.effects.filter((effect) =>
      isEffectConditionMet(nextGame, context, effect),
    )

    if (availableEffects.length === 0) {
      setMessage(`${card.name}的效果尚未滿足發動條件。`)
      return
    }

    if (
      !canActivateCookieSkill(
        nextGame,
        playerId,
        card.instanceId,
        trigger,
      )
    ) {
      setMessage(`${card.name}目前無法支付或發動技能。`)
      return
    }

    setPendingEffect({
      sourceCard: card,
      context,
      skill: card.skill,
      trigger,
      effects: availableEffects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      skillActivated: false,
      optional,
      triggerLabel,
    })
    setMessage(`${card.name}的技能等待支付能量並選擇目標。`)
  }

  const runAction = (
    action: (current: GameState) => GameState,
    successMessage: string,
    onSuccess?: (nextGame: GameState) => void,
  ) => {
    try {
      const nextGame = action(game)
      setGame(nextGame)
      setMessage(successMessage)
      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  const handleAdvancePhase = () => {
    if (pendingEffect) return
    runAction(advancePhase, '階段已推進。')
    setSelectedAttackerId(null)
  }

  const handleAttackTarget = (targetInstanceId: string) => {
    if (!selectedAttackerId) return

    const attacker = activePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === selectedAttackerId,
    )
    const supportPaymentIds = activePlayer.supportArea
      .filter((support) => !support.rested)
      .slice(0, attacker?.card.attackCost ?? 0)
      .map((support) => support.card.instanceId)

    runAction(
      (current) =>
        attackCookie(
          current,
          selectedAttackerId,
          targetInstanceId,
          supportPaymentIds,
      ),
      `${attacker?.card.name ?? '餅乾'}完成攻擊。`,
    )
    setSelectedAttackerId(null)
  }

  const toggleEffectTarget = (instanceId: string) => {
    if (!pendingEffect || !currentEffect || !effectTargetIds.has(instanceId)) {
      return
    }

    const isSelected = pendingEffect.selectedTargetIds.includes(instanceId)
    const selectedTargetIds = isSelected
      ? pendingEffect.selectedTargetIds.filter((id) => id !== instanceId)
      : pendingEffect.selectedTargetIds.length < currentEffect.target.max
        ? [...pendingEffect.selectedTargetIds, instanceId]
        : pendingEffect.selectedTargetIds

    setPendingEffect({ ...pendingEffect, selectedTargetIds })
  }

  const toggleSkillPayment = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return

    const isSelected =
      pendingEffect.selectedPaymentIds.includes(instanceId)
    const selectedPaymentIds = isSelected
      ? pendingEffect.selectedPaymentIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedPaymentIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedPaymentIds })
  }

  const skipOptionalSkill = () => {
    if (!pendingEffect?.optional) return

    setMessage(`${pendingEffect.sourceCard.name}的 OnPlay 技能未發動。`)
    setPendingEffect(null)
  }

  const confirmEffect = () => {
    if (!pendingEffect || !currentEffect) return

    const targetNames = pendingEffect.selectedTargetIds.map(
      (instanceId) =>
        effectTargetCandidates.find(
          (cookie) => cookie.card.instanceId === instanceId,
        )?.card.name ?? instanceId,
    )

    try {
      const activatedGame = pendingEffect.skillActivated
        ? game
        : activateCookieSkill(
            game,
            pendingEffect.context.sourcePlayerId,
            pendingEffect.sourceCard.instanceId,
            pendingEffect.trigger,
            pendingEffect.selectedPaymentIds,
          )
      const nextGame = executeCardEffect(
        activatedGame,
        pendingEffect.context,
        currentEffect,
        pendingEffect.selectedTargetIds,
      )
      const result = describeEffectResult(currentEffect, targetNames)
      const nextEffectIndex = pendingEffect.effectIndex + 1

      setGame(nextGame)
      setMessage(result)
      setEffectHistory((history) => [result, ...history].slice(0, 4))
      setPendingEffect(
        nextEffectIndex < pendingEffect.effects.length
          ? {
              ...pendingEffect,
              effectIndex: nextEffectIndex,
              selectedTargetIds: [],
              skillActivated: true,
            }
          : null,
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '效果無法執行。',
      )
    }
  }

  const pendingPlayerId =
    game.pendingRefresh?.playerId ?? game.pendingReplacementPlayerId
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer?.hand.filter((card) => card.type === 'cookie') ?? []

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <aside className="phase-rail" aria-label="回合階段">
        <div className="brand-mark">
          <span>COOKIE RUN</span>
          <strong>BRAVERSE</strong>
        </div>
        <ol>
          {phases.map((phase, index) => (
            <li
              className={game.phase === phase ? 'is-current' : ''}
              key={phase}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{phaseLabels[phase]}</strong>
            </li>
          ))}
        </ol>
        <button
          className="next-phase-button"
          type="button"
          onClick={handleAdvancePhase}
          disabled={
            game.status === 'finished' ||
            Boolean(game.pendingReplacementPlayerId) ||
            Boolean(game.pendingRefresh) ||
            Boolean(pendingEffect)
          }
        >
          <span>{nextPhaseLabels[game.phase]}</span>
          <ChevronRight aria-hidden="true" />
        </button>
        <span className="turn-counter">TURN {game.turnNumber}</span>
      </aside>

      <header className="match-toolbar">
        <div className="match-status">
          <span>{activePlayer.name}的回合</span>
          <strong>{phaseLabels[game.phase]}</strong>
          <small>{message}</small>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            title="重新開始"
            onClick={() => {
              setGame(createDemoGame())
              setSelectedAttackerId(null)
              setPendingEffect(null)
              setEffectHistory([])
              setMessage('已建立新的 Starter Deck RED 範例對局。')
            }}
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            title="暫停資訊"
            onClick={() => setShowPause(true)}
          >
            <Pause aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="table-area" aria-label="Braverse 對戰桌">
        <BattleRow
          game={game}
          playerId={opponentId}
          position="top"
          selectedAttackerId={selectedAttackerId}
          effectTargetIds={effectTargetIds}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={selectedSkillPaymentIds}
          interactionLocked={Boolean(pendingEffect)}
          onAttackTarget={handleAttackTarget}
          onEffectTarget={toggleEffectTarget}
          onInspectCard={setInspectedCard}
        />

        <div className="table-divider">
          <span />
          <strong>
            {pendingEffect ? (
              <>
                <Sparkles aria-hidden="true" /> 選擇效果目標
              </>
            ) : selectedAttackerId ? (
              <>
                <Swords aria-hidden="true" /> 選擇攻擊目標
              </>
            ) : (
              `${activePlayer.name} · ${phaseLabels[game.phase]}`
            )}
          </strong>
          <span />
        </div>

        <BattleRow
          game={game}
          playerId={viewerPlayerId}
          position="bottom"
          selectedAttackerId={selectedAttackerId}
          effectTargetIds={effectTargetIds}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={selectedSkillPaymentIds}
          interactionLocked={Boolean(pendingEffect)}
          onSelectAttacker={(instanceId) => {
            setSelectedAttackerId(instanceId)
            setMessage('選擇對手戰鬥區中的攻擊目標。')
          }}
          onEffectTarget={toggleEffectTarget}
          onPlaceSupport={(instanceId) =>
            runAction(
              (current) => placeSupportCard(current, instanceId),
              '已將卡牌配置到支援區。',
            )
          }
          onSkillPayment={toggleSkillPayment}
          onActivateSkill={(instanceId) => {
            const card = activePlayer.battleArea.find(
              (cookie) => cookie.card.instanceId === instanceId,
            )?.card
            beginCookieSkill(
              game,
              card,
              activePlayer.id,
              'activate',
              'Activate 主動發動',
            )
          }}
          onDeployCookie={(instanceId) =>
            runAction(
              (current) => deployCookie(current, instanceId),
              '新餅乾已登場並配置 HP。',
              (nextGame) =>
                beginCookieSkill(
                  nextGame,
                  activePlayer.hand.find(
                    (card) => card.instanceId === instanceId,
                  ),
                  activePlayer.id,
                  'on-play',
                  'OnPlay 登場觸發',
                  true,
                ),
            )
          }
          onInspectCard={setInspectedCard}
        />
      </section>

      {(pendingEffect || effectHistory.length > 0) && (
        <aside className="effect-panel" aria-live="polite">
          {pendingEffect && currentEffect ? (
            <>
              <span>{pendingEffect.triggerLabel}</span>
              <strong>{pendingEffect.sourceCard.name}</strong>
              <div className="skill-labels">
                {getSkillLabels(pendingEffect.skill).map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <p>{pendingEffect.sourceCard.effectText}</p>
              {!pendingEffect.skillActivated && (
                <div className="skill-cost">
                  <strong>技能費用</strong>
                  <span>{describeSkillCost(pendingEffect.skill)}</span>
                  <small>
                    已選 {pendingEffect.selectedPaymentIds.length} 張支援卡
                  </small>
                </div>
              )}
              <div className="effect-instruction">
                <Sparkles aria-hidden="true" />
                <span>{describeEffect(currentEffect)}</span>
              </div>
              <small>
                已選 {pendingEffect.selectedTargetIds.length}／
                {currentEffect.target.max}
              </small>
              <button
                type="button"
                disabled={
                  (!pendingEffect.skillActivated &&
                    pendingEffect.selectedPaymentIds.length !==
                      getSkillCostTotal(pendingEffect.skill)) ||
                  pendingEffect.selectedTargetIds.length <
                    currentEffect.target.min ||
                  pendingEffect.selectedTargetIds.length >
                    currentEffect.target.max
                }
                onClick={confirmEffect}
              >
                <Check aria-hidden="true" />
                確認效果
              </button>
              {pendingEffect.optional && !pendingEffect.skillActivated && (
                <button
                  className="skip-effect"
                  type="button"
                  onClick={skipOptionalSkill}
                >
                  不發動
                </button>
              )}
            </>
          ) : (
            <>
              <span>效果紀錄</span>
              <strong>{effectHistory[0]}</strong>
            </>
          )}
          {effectHistory.length > 0 && (
            <ol>
              {effectHistory.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          )}
        </aside>
      )}

      <button
        className="inspect-hand-button"
        type="button"
        onClick={() =>
          setInspectedCard(game.players[viewerPlayerId].hand[0] ?? null)
        }
      >
        <Eye aria-hidden="true" />
        <span>查看卡牌</span>
      </button>

      {pendingPlayer && (
        <div className="modal-backdrop" role="presentation">
          <section className="decision-modal" role="alertdialog">
            <div className="modal-title">
              {game.pendingRefresh ? '牌庫 Refresh' : '放置餅乾'}
            </div>
            <div className="modal-body">
              <strong>
                {game.pendingRefresh
                  ? `${pendingPlayer.name}必須選擇一張餅乾放入休息區`
                  : `${pendingPlayer.name}必須在戰鬥區放置新餅乾`}
              </strong>
              <div className="modal-card-options">
                {pendingOptions.map((card) => (
                  <button
                    type="button"
                    key={card.instanceId}
                    disabled={
                      !game.pendingRefresh &&
                      card.type === 'cookie' &&
                      pendingPlayer.deck.length < card.hp
                    }
                    onClick={() => {
                      if (game.pendingRefresh) {
                        runAction(
                          (current) =>
                            refreshDeck(
                              current,
                              pendingPlayer.id,
                              card.instanceId,
                            ),
                          '牌庫 Refresh 已完成。',
                        )
                      } else {
                        runAction(
                          (current) =>
                            replaceDefeatedCookie(current, card.instanceId),
                          '已補充新的戰鬥區餅乾。',
                        )
                      }
                    }}
                  >
                    <CardFace card={card} />
                    <span>{card.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {inspectedCard && (
        <div className="modal-backdrop" role="presentation">
          <section className="card-detail-modal" role="dialog">
            <button
              className="close-modal"
              type="button"
              title="關閉"
              onClick={() => setInspectedCard(null)}
            >
              <X aria-hidden="true" />
            </button>
            <CardFace card={inspectedCard} className="detail-card" />
            <div>
              <span>{inspectedCard.id}</span>
              <h2>{inspectedCard.name}</h2>
              <p>
                {inspectedCard.type === 'cookie'
                  ? `LV ${inspectedCard.level} · HP ${inspectedCard.hp} · 攻擊 ${inspectedCard.attack} · 費用 ${inspectedCard.attackCost}`
                  : `卡牌類型：${inspectedCard.type.toUpperCase()}`}
              </p>
              {inspectedCard.effectText && (
                <div className="card-effect-copy">
                  <strong>卡牌效果</strong>
                  {inspectedCard.skill && (
                    <>
                      <div className="skill-labels">
                        {getSkillLabels(inspectedCard.skill).map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                      <small>
                        費用：{describeSkillCost(inspectedCard.skill)}
                      </small>
                    </>
                  )}
                  <p>{inspectedCard.effectText}</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {showPause && (
        <div className="modal-backdrop" role="presentation">
          <section className="pause-modal" role="dialog">
            <Pause aria-hidden="true" />
            <span>對戰資訊</span>
            <h2>遊戲已暫停</h2>
            <p>目前為第 {game.turnNumber} 回合，{phaseLabels[game.phase]}。</p>
            <button type="button" onClick={() => setShowPause(false)}>
              繼續對戰
            </button>
          </section>
        </div>
      )}

      {game.result && (
        <div className="modal-backdrop result-backdrop" role="presentation">
          <section className="result-modal" role="alertdialog">
            <span>對局結束</span>
            <h2>{game.players[game.result.winnerId].name}勝利</h2>
            <p>
              {game.result.reason === 'break-level-limit'
                ? '對手休息區等級達到 10。'
                : game.result.reason === 'refresh-unavailable'
                  ? '對手無法完成牌庫 Refresh。'
                  : '對手沒有可登場的餅乾。'}
            </p>
            <button
              type="button"
              onClick={() => {
                setGame(createDemoGame())
                setSelectedAttackerId(null)
                setPendingEffect(null)
                setEffectHistory([])
              }}
            >
              再來一局
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
