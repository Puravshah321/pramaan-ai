import React, { useState, useEffect } from 'react'
import {
  Activity, Play, Pause, Square, AlertCircle,
  CheckCircle2, Clock, Cpu, HardDrive, Zap, Terminal
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function MonitorPage() {
  const { demoMode, activeHardware } = useAppStore()
  const [status, setStatus] = useState<'running' | 'paused' | 'completed'>('running')
  const [completedRuns, setCompletedRuns] = useState<number>(24)
  const totalRuns = 36

  // Sample real-time log lines
  const [logs, setLogs] = useState<string[]>([
    '[10:04:12] [INFO] [pramaan.benchmark] Initializing worker process pool for hardware: ' + activeHardware,
    '[10:04:15] [INFO] [pramaan.benchmark] Running config cfg_8a1f (chunk=256, k=3, bge-small, Qwen-1.5B Q4_K_M)',
    '[10:04:22] [INFO] [pramaan.telemetry] Peak VRAM: 2,142 MB, RSS: 3,420 MB, Latency median: 320 ms',
    '[10:04:29] [INFO] [pramaan.metrics] Evaluated 60 questions. Recall@3: 0.884, F1: 0.742',
    '[10:04:32] [INFO] [pramaan.pruner] Successive halving check passed: config in top 30% quantile',
    '[10:04:45] [INFO] [pramaan.benchmark] Running config cfg_9c2d (chunk=512, k=5, bge-small, Qwen-1.5B Q4_K_M)',
  ])

  useEffect(() => {
    if (status !== 'running') return
    const interval = setInterval(() => {
      setCompletedRuns((prev) => {
        if (prev >= totalRuns) {
          setStatus('completed')
          return totalRuns
        }
        return prev + 1
      })
      setLogs((prev) => [
        ...prev.slice(-10),
        `[${new Date().toLocaleTimeString()}] [INFO] [pramaan.telemetry] Heartbeat: CPU 24.2%, VRAM 2,410 MB, Sampling rate: 20 Hz`,
      ])
    }, 4000)
    return () => clearInterval(interval)
  }, [status, totalRuns])

  const progressPct = Math.round((completedRuns / totalRuns) * 100)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header with control actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
              Real-Time Run Monitor
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                status === 'running'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse'
                  : status === 'paused'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}
            >
              {status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Live process-isolated execution telemetry with continuous VRAM/RAM sampling at 20 Hz and successive-halving pruning.
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {status === 'running' ? (
            <button
              onClick={() => setStatus('paused')}
              className="px-3.5 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] transition-colors flex items-center gap-1.5"
            >
              <Pause size={14} className="text-amber-400" />
              <span>Pause Run</span>
            </button>
          ) : (
            <button
              onClick={() => setStatus('running')}
              className="px-3.5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              <Play size={14} />
              <span>Resume</span>
            </button>
          )}

          <button
            onClick={() => setStatus('completed')}
            className="px-3.5 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
          >
            <Square size={14} className="text-rose-400" />
            <span>Cancel Run</span>
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <div className="space-y-1">
            <span className="text-[var(--color-text-muted)] font-medium">Sweep Progress</span>
            <div className="text-lg font-bold text-[var(--color-text)]">
              {completedRuns} of {totalRuns} Configurations Finished
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-[var(--color-primary)]">
              {progressPct}%
            </span>
            <div className="text-[11px] text-[var(--color-text-muted)]">Est. Remaining: ~3 min</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[var(--color-surface-raised)] h-3 rounded-full overflow-hidden border border-[var(--color-border)] p-0.5">
          <div
            className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Current Config Badge */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Currently Evaluating:</span>
            <span className="font-mono font-semibold text-[var(--color-text)] bg-[var(--color-surface-raised)] px-2 py-0.5 rounded border border-[var(--color-border)]">
              Qwen2.5-1.5B (Q4_K_M) • Chunk: 512 • Top-K: 5 • bge-small
            </span>
          </div>
          <div className="flex items-center gap-3 text-[var(--color-text-muted)] font-mono text-[11px]">
            <span>Peak VRAM: <strong className="text-emerald-400">2.41 GB</strong></span>
            <span>•</span>
            <span>Latency p95: <strong className="text-indigo-400">388 ms</strong></span>
          </div>
        </div>
      </div>

      {/* Telemetry & Console Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Gauges */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Zap size={16} className="text-cyan-400" />
              <span>Resource Telemetry (20 Hz)</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Cpu size={14} className="text-cyan-400" />
                    <span>VRAM Utilization</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">2.41 / 4.00 GB (60%)</span>
                </div>
                <div className="w-full bg-[var(--color-surface-raised)] h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '60%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <HardDrive size={14} className="text-indigo-400" />
                    <span>Host RAM (RSS)</span>
                  </span>
                  <span className="font-mono text-[var(--color-text)] font-bold">4.2 / 16.0 GB (26%)</span>
                </div>
                <div className="w-full bg-[var(--color-surface-raised)] h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: '26%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--color-text-muted)] flex items-center gap-1.5">
                    <Activity size={14} className="text-amber-400" />
                    <span>GPU Compute Load</span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">78%</span>
                </div>
                <div className="w-full bg-[var(--color-surface-raised)] h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '78%' }} />
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] space-y-1">
              <div className="flex justify-between">
                <span>OOM Abort Guard:</span>
                <span className="text-emerald-400 font-medium">Armed (threshold 95%)</span>
              </div>
              <div className="flex justify-between">
                <span>Resumability State:</span>
                <span className="text-[var(--color-text)] font-medium">Checkpoint saved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Execution Console */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2">
              <Terminal size={16} className="text-emerald-400" />
              <span>Process-Isolated Worker Logs</span>
            </h3>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">Live Stream</span>
          </div>

          <div className="bg-[#050811] p-4 rounded-lg font-mono text-[11px] text-gray-300 h-64 overflow-y-auto space-y-1.5 border border-white/5">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                {log.includes('INFO') && <span className="text-blue-400">{log}</span>}
                {log.includes('Peak') && <span className="text-emerald-400">{log}</span>}
                {!log.includes('INFO') && !log.includes('Peak') && <span>{log}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
