import type { GameCard, GameState, PlayerId } from '../../game'
import type {
  OnlineOpeningAction,
  OnlineOpeningSnapshot,
  RpsChoice,
} from '../../net/onlineProtocol'
import { CardFace } from '../cards/CardVisuals'

const rpsLabels: Record<RpsChoice, string> = {
  rock: '石頭',
  paper: '布',
  scissors: '剪刀',
}

const openingSteps = ['猜拳', '先後攻', '調度', '起始餅乾'] as const

const stageStepIndex = (stage: OnlineOpeningSnapshot['stage']): number => {
  if (stage === 'rps') return 0
  if (stage === 'choose-order') return 1
  if (
    stage === 'mulligan' ||
    stage === 'forced-mulligan' ||
    stage === 'compensation'
  ) {
    return 2
  }
  return 3
}

export interface OnlineOpeningOverlayProps {
  opening: OnlineOpeningSnapshot
  game: GameState | null
  viewerPlayerId: PlayerId
  roomCode: string | null
  errorMessage?: string | null
  onAction: (action: OnlineOpeningAction) => void
  onLeave: () => void
}

const OpeningHand = ({
  cards,
  selectable,
  onSelect,
}: {
  cards: GameCard[]
  selectable?: boolean
  onSelect?: (instanceId: string) => void
}) => (
  <div
    className="online-opening-hand"
    data-testid="online-opening-hand"
    aria-label="起始手牌"
  >
    {cards.map((card) => {
      const canSelect = Boolean(selectable && card.type === 'cookie' && onSelect)
      const content = (
        <>
          <CardFace card={card} />
          <span>{card.name}</span>
        </>
      )
      return canSelect ? (
        <button
          key={card.instanceId}
          className="online-opening-card is-selectable"
          data-testid="online-starting-cookie"
          type="button"
          aria-label={`選擇 ${card.name} 作為起始餅乾`}
          onClick={() => onSelect?.(card.instanceId)}
        >
          {content}
        </button>
      ) : (
        <div
          key={card.instanceId}
          className="online-opening-card"
          data-testid="online-opening-card"
        >
          {content}
        </div>
      )
    })}
  </div>
)

export function OnlineOpeningOverlay({
  opening,
  game,
  viewerPlayerId,
  roomCode,
  errorMessage,
  onAction,
  onLeave,
}: OnlineOpeningOverlayProps) {
  const opponentId: PlayerId =
    viewerPlayerId === 'player-one' ? 'player-two' : 'player-one'
  const viewer = opening.players[viewerPlayerId]
  const opponent = opening.players[opponentId]
  const actorIsViewer = opening.actorId === viewerPlayerId
  const currentStep = stageStepIndex(opening.stage)
  const viewerHand = game?.players[viewerPlayerId].hand ?? []
  const rpsResult = opening.rpsResult

  const statusMessage = (() => {
    switch (opening.stage) {
      case 'rps':
        if (viewer.submitted) return '已送出選擇，等待對手完成猜拳…'
        if (opponent.submitted) {
          return `${opponent.name} 已送出猜拳，輪到你選擇。`
        }
        if (rpsResult?.winnerId === null) {
          return `上一輪平手，請進行第 ${opening.round} 輪猜拳。`
        }
        return `第 ${opening.round} 輪：請選擇石頭、布或剪刀。`
      case 'choose-order':
        return actorIsViewer
          ? '你贏得猜拳，請選擇先攻或後攻。'
          : `${opening.players[opening.actorId!].name} 正在選擇先攻或後攻…`
      case 'mulligan':
        return actorIsViewer
          ? '輪到你決定是否調度全部起始手牌。'
          : `${opening.players[opening.actorId!].name} 正在決定是否調度…`
      case 'forced-mulligan':
        return actorIsViewer
          ? '手牌沒有餅乾，必須公開手牌並重新抽取 6 張。'
          : `${opening.players[opening.actorId!].name} 正在進行強制調度…`
      case 'compensation':
        return actorIsViewer
          ? '對手公開了沒有餅乾的手牌，你可以抽取 1 張補償。'
          : `${opening.players[opening.actorId!].name} 正在決定是否抽取調度補償…`
      case 'starting-cookie':
        return viewer.submitted
          ? '起始餅乾已覆蓋，等待對手完成選擇…'
          : opponent.submitted
            ? `${opponent.name} 已覆蓋起始餅乾，輪到你選擇；雙方完成後會同時翻開。`
            : '選擇一張餅乾覆蓋到戰鬥區；雙方完成後會同時翻開。'
    }
  })()

  return (
    <div className="online-opening-layer">
      <section
        className="online-opening-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="online-opening-title"
      >
        <header className="online-opening-header">
          <div>
            <span className="online-opening-kicker">ONLINE MATCH</span>
            <h2 id="online-opening-title">開局準備</h2>
          </div>
          {roomCode && <span className="online-opening-room">房號 {roomCode}</span>}
        </header>

        <ol className="online-opening-progress" aria-label="開局流程進度">
          {openingSteps.map((step, index) => (
            <li
              key={step}
              className={
                index < currentStep
                  ? 'is-complete'
                  : index === currentStep
                    ? 'is-current'
                    : ''
              }
            >
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>

        <div className="online-opening-versus" aria-label="對戰玩家">
          <div className="online-opening-player is-viewer">
            <small>YOU</small>
            <strong>{viewer.name}</strong>
            {opening.firstPlayerId && (
              <b>{opening.firstPlayerId === viewerPlayerId ? '先攻' : '後攻'}</b>
            )}
          </div>
          <span>VS</span>
          <div className="online-opening-player is-opponent">
            <small>OPPONENT</small>
            <strong>{opponent.name}</strong>
            {opening.firstPlayerId && (
              <b>{opening.firstPlayerId === opponentId ? '先攻' : '後攻'}</b>
            )}
          </div>
        </div>

        <p className="online-opening-status" role="status" aria-live="polite">
          {statusMessage}
        </p>
        {errorMessage && (
          <p className="online-opening-error" role="alert">
            {errorMessage}
          </p>
        )}

        {rpsResult &&
          (opening.stage === 'rps' || opening.stage === 'choose-order') && (
            <div
              className="online-opening-rps-result"
              data-testid="online-rps-result"
            >
              <span>
                {viewer.name}：{rpsLabels[rpsResult.choices[viewerPlayerId]]}
              </span>
              <strong>
                {rpsResult.winnerId === null
                  ? '平手'
                  : rpsResult.winnerId === viewerPlayerId
                    ? '你獲勝'
                    : `${opponent.name} 獲勝`}
              </strong>
              <span>
                {opponent.name}：{rpsLabels[rpsResult.choices[opponentId]]}
              </span>
            </div>
          )}

        {opening.stage === 'rps' && !viewer.submitted && (
          <div className="online-opening-actions online-rps-actions">
            <button type="button" onClick={() => onAction({ kind: 'rps', choice: 'rock' })}>
              石頭
            </button>
            <button type="button" onClick={() => onAction({ kind: 'rps', choice: 'paper' })}>
              布
            </button>
            <button type="button" onClick={() => onAction({ kind: 'rps', choice: 'scissors' })}>
              剪刀
            </button>
          </div>
        )}

        {opening.stage === 'choose-order' && actorIsViewer && (
          <div className="online-opening-actions">
            <button type="button" onClick={() => onAction({ kind: 'choose-order', goFirst: true })}>
              選擇先攻
            </button>
            <button type="button" onClick={() => onAction({ kind: 'choose-order', goFirst: false })}>
              選擇後攻
            </button>
          </div>
        )}

        {(opening.stage === 'mulligan' ||
          opening.stage === 'forced-mulligan' ||
          opening.stage === 'starting-cookie') &&
          game && (
            <OpeningHand
              cards={viewerHand}
              selectable={
                opening.stage === 'starting-cookie' && !viewer.submitted
              }
              onSelect={(instanceId) =>
                onAction({ kind: 'starting-cookie', instanceId })
              }
            />
          )}

        {opening.stage === 'mulligan' && actorIsViewer && (
          <div className="online-opening-actions">
            <button type="button" onClick={() => onAction({ kind: 'mulligan', replaceAll: false })}>
              保留手牌
            </button>
            <button type="button" onClick={() => onAction({ kind: 'mulligan', replaceAll: true })}>
              全部調度
            </button>
          </div>
        )}

        {opening.stage === 'forced-mulligan' && actorIsViewer && (
          <div className="online-opening-actions">
            <button type="button" onClick={() => onAction({ kind: 'force-mulligan' })}>
              公開並重新抽牌
            </button>
          </div>
        )}

        {opening.stage === 'compensation' && (
          <>
            <p className="online-opening-reveal-label">公開的無餅乾手牌</p>
            <OpeningHand cards={opening.revealedNoCookieHand} />
            {actorIsViewer && (
              <div className="online-opening-actions">
                <button
                  type="button"
                  onClick={() =>
                    onAction({ kind: 'mulligan-compensation', draw: true })
                  }
                >
                  抽取 1 張
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onAction({ kind: 'mulligan-compensation', draw: false })
                  }
                >
                  不抽取
                </button>
              </div>
            )}
          </>
        )}

        <button className="online-opening-leave" type="button" onClick={onLeave}>
          離開對局
        </button>
      </section>
    </div>
  )
}
