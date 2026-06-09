import { X } from 'lucide-react'
import { getEnergyCostTotal, type AiMatchResult, type EnergyCost } from '../../game'
import { EnergyCostIcons } from '../cards/CardVisuals'
import './GameStatusPanels.css'

export interface AttackPaymentPanelProps {
  attackerName: string
  attackCost: EnergyCost
  selectedPaymentCount: number
  isValid: boolean
  validationReason: string
  onCancel: () => void
}

export function AttackPaymentPanel({
  attackerName,
  attackCost,
  selectedPaymentCount,
  isValid,
  validationReason,
  onCancel,
}: AttackPaymentPanelProps) {
  const totalCost = getEnergyCostTotal(attackCost)

  return (
    <aside
      className={`attack-payment-panel ${isValid ? 'is-valid' : 'is-invalid'}`}
      aria-live="polite"
      data-testid="attack-payment-panel"
    >
      <span>攻擊能量支付</span>
      <strong>{attackerName}</strong>
      <div className="attack-cost-row">
        <span>需求</span>
        <EnergyCostIcons cost={attackCost} />
      </div>
      <small>
        已選 {selectedPaymentCount}／{totalCost} 張支援卡
      </small>
      <p>{validationReason}</p>
      {isValid && (
        <em>付款合法，請選擇對手戰鬥區中的攻擊目標。</em>
      )}
      <button type="button" onClick={onCancel}>
        取消攻擊
      </button>
    </aside>
  )
}

export interface AiStatusPanelProps {
  aiThinking: boolean
  aiActionCount: number
  onRunSimulation: () => void
}

export function AiStatusPanel({
  aiThinking,
  aiActionCount,
  onRunSimulation,
}: AiStatusPanelProps) {
  return (
    <aside className="ai-status-panel" aria-live="polite">
      <span>簡易 AI 對手</span>
      <strong>{aiThinking ? '正在決策' : '等待下一步'}</strong>
      <small>已執行 {aiActionCount} 個動作</small>
      <button type="button" onClick={onRunSimulation}>
        執行 20 場 AI 驗證
      </button>
    </aside>
  )
}

export interface SimulationReportProps {
  simulationResults: AiMatchResult[]
  seeds: number[]
  onClose: () => void
}

export function SimulationReport({
  simulationResults,
  seeds,
  onClose,
}: SimulationReportProps) {
  return (
    <section className="simulation-report" data-testid="ai-simulation-report">
      <button
        type="button"
        className="close-modal"
        title="關閉"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
      <span>瀏覽器自動對戰報告</span>
      <h2>
        {simulationResults.filter((result) => !result.stuck).length}
        /20 場完成
      </h2>
      <div className="simulation-table">
        {simulationResults.map((result, index) => (
          <div
            key={seeds[index]}
            data-testid={`ai-simulation-match-${index + 1}`}
            data-validation={JSON.stringify(
              result.stuck
                ? {
                    seed: seeds[index],
                    state: result.state,
                    logs: result.logs.slice(-20),
                    error: result.error,
                  }
                : {
                    seed: seeds[index],
                    winnerId: result.state.result?.winnerId,
                    reason: result.state.result?.reason,
                    turnNumber: result.state.turnNumber,
                    actions: result.actions,
                    metrics: result.metrics,
                  },
            )}
          >
            <strong>
              #{index + 1} · 種子 {seeds[index]}
            </strong>
            <span>
              {result.stuck
                ? '卡住'
                : `${result.state.players[result.state.result!.winnerId].name}勝利`}
            </span>
            <span>回合 {result.state.turnNumber}</span>
            <span>{result.actions} 步</span>
            <span>技能 {result.metrics.skillActivations}</span>
            <span>Refresh {result.metrics.refreshes}</span>
            <span>補位 {result.metrics.replacements}</span>
            <code>
              {result.error ??
                result.state.result?.reason ??
                'completed'}
            </code>
          </div>
        ))}
      </div>
    </section>
  )
}
