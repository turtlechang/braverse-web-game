import { phaseLabels } from '../gameUiLabels'
import {
  DiscardRevealModal,
  CardDetailModal,
  CardRevealModal,
  CardPileModal,
  PauseModal,
  DeckListModal,
} from '../modals/GameModals'
import type { useMatchController } from '../../hooks/useMatchController'
import type { useAiTurn } from '../../hooks/useAiTurn'
import type { useMatchDialogs } from '../../hooks/useMatchDialogs'

export interface InformationModalsProps {
  match: ReturnType<typeof useMatchController>
  ai: ReturnType<typeof useAiTurn>
  dialogs: ReturnType<typeof useMatchDialogs>
}

export function InformationModals({ match, ai, dialogs }: InformationModalsProps) {
  return (
    <>
      {ai.pendingAiDecision?.revealedCard && (
        <CardRevealModal
          card={ai.pendingAiDecision.revealedCard}
          title="AI 公開卡牌"
          description={
            ai.pendingAiDecision.revealedCard.effectText ??
            ai.pendingAiDecision.description
          }
          confirmLabel="確認並繼續 AI 行動"
          onConfirm={ai.confirmAiDecision}
        />
      )}

      {ai.pendingAiDecision?.revealedCards?.length ? (
        <DiscardRevealModal
          cards={ai.pendingAiDecision.revealedCards}
          onConfirm={ai.confirmAiDecision}
        />
      ) : null}

      {dialogs.inspectedCard && (
        <CardDetailModal
          card={dialogs.inspectedCard}
          onClose={dialogs.closeCardDetail}
        />
      )}

      {dialogs.inspectedDiscardPlayerId && (
        <CardPileModal
          title={`${match.game.players[dialogs.inspectedDiscardPlayerId].name}棄牌區`}
          cards={
            match.game.players[dialogs.inspectedDiscardPlayerId]
              .discardPile
          }
          onInspect={(card) => {
            dialogs.closeDiscardPile()
            dialogs.openCardDetail(card)
          }}
          onClose={dialogs.closeDiscardPile}
        />
      )}

      {dialogs.inspectedHpPile && (
        <CardPileModal
          title={dialogs.inspectedHpPile.title}
          cards={dialogs.inspectedHpPile.cards}
          onInspect={dialogs.openCardDetail}
          onClose={dialogs.closeHpPile}
        />
      )}

      {dialogs.showPause && (
        <PauseModal
          turnNumber={match.game.turnNumber}
          phaseLabel={phaseLabels[match.game.phase]}
          deckConfig={match.deckConfig}
          aiActionCount={ai.aiActionCount}
          onRunSimulation={() => {
            dialogs.closePause()
            ai.runSimulation()
          }}
          onResume={dialogs.closePause}
        />
      )}

      {dialogs.showDeckList && (
        <DeckListModal
          deckListOwner={dialogs.deckListOwner}
          viewedDeck={match.deckConfig[dialogs.deckListOwner]}
          customDeck={match.selectedCustomDeck}
          onSetDeckListOwner={dialogs.openDeckList}
          onClose={dialogs.closeDeckList}
        />
      )}
    </>
  )
}
