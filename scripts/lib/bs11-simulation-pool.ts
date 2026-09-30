import { Worker } from 'node:worker_threads'
import type { SwissSimulationInput, SwissSimulationOutcome } from '../../src/game/tournament'

/** Workers execute the authoritative simulator; Swiss sorting remains in the parent. */
export class Bs11SimulationPool {
  private workers: Worker[] = []
  private serial = 0
  constructor(count = 4) {
    if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error('Worker count must be 1-8')
    this.workers = Array.from({ length: count }, () => new Worker(new URL('./bs11-simulation-worker.mjs', import.meta.url), { execArgv: [] }))
  }
  async simulateRound(inputs: SwissSimulationInput[]): Promise<SwissSimulationOutcome[]> {
    const outcomes: SwissSimulationOutcome[] = new Array(inputs.length)
    let next = 0
    await Promise.all(this.workers.map(async (worker) => {
      while (next < inputs.length) {
        const index = next++
        const id = this.serial++
        outcomes[index] = await new Promise<SwissSimulationOutcome>((resolve, reject) => {
          const clean = () => {
            worker.off('message', receive)
            worker.off('error', fail)
            worker.off('exit', exited)
          }
          const receive = (message: { id: number; outcome: SwissSimulationOutcome }) => {
            if (message.id !== id) { clean(); reject(new Error('Simulation worker response identity mismatch')); return }
            clean(); resolve(message.outcome)
          }
          const fail = (error: Error) => { clean(); reject(error) }
          const exited = (code: number) => { clean(); reject(new Error(`Simulation worker exited before outcome: ${code}`)) }
          worker.on('message', receive)
          worker.once('error', fail)
          worker.once('exit', exited)
          worker.postMessage({ id, input: inputs[index] })
        })
      }
    }))
    return outcomes
  }
  async close(): Promise<void> { await Promise.all(this.workers.map((worker) => worker.terminate())) }
}
