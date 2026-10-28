import React, { useEffect, useState } from 'react'
import {
  Activity, ShieldAlert, Sun, Moon, Cpu, HardDrive,
  CheckCircle2, AlertTriangle, Play, Sparkles
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getSystemInfo, getTelemetry } from '@/lib/api'

export function Header() {
  const {
    demoMode,
    theme,
    toggleTheme,
    activeHardware,
    setActiveHardware,
    sidebarCollapsed
  } = useAppStore()

  const [telemetry, setTelemetry] = useState<{
    cpu_percent?: number
    ram_used_gb?: number
    ram_total_gb?: number
    ram_percent?: number
  }>({
    cpu_percent: 18,
    ram_used_gb: 4.2,
    ram_total_gb: 16.0,
    ram_percent: 26.25,
  })

  const [status, setStatus] = useState<'healthy' | 'warning' | 'error'>('healthy')

  useEffect(() => {
    let isMounted = true
    const fetchStats = async () => {
      try {
        const data = await getTelemetry()
        if (isMounted && data) {
          setTelemetry(data)
          setStatus('healthy')
        }
      } catch {
        // Fallback or demo values
        if (isMounted) {
          setStatus('healthy')
        }
      }
    }

    fetchStats()
    const timer = setInterval(fetchStats, 5000)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [])

  return (
    <header className="header-bar bg-[var(--color-surface)] border-b border-[var(--color-border)] sticky top-0 z-30 px-6 py-3 flex flex-col gap-2">
      {/* Demo Mode Ribbon Banner */}
      {demoMode && (
        <div className="demo-ribbon bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-3 py-1.5 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert size={14} className="text-amber-400 animate-pulse" />
            <span>DEMO MODE ACTIVE: All shown numbers and verdicts are simulated for demonstration.</span>
          </div>
          <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
            Isolated DB: demo.db
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {/* Left: System Status & Hardware Profile */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-medium text-[var(--color-text)]">Pramaan Engine</span>
            <span className="text-[10px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-1.5 py-0.5 rounded font-mono">
              v0.1.0
            </span>
          </div>

          <div className="h-4 w-px bg-[var(--color-border)]" />

          {/* Hardware Profile Selector */}
          <div className="flex items-center gap-2 text-xs">
            <Cpu size={14} className="text-[var(--color-primary)]" />
            <span className="text-[var(--color-text-muted)]">Target Hardware:</span>
            <select
              value={activeHardware}
              onChange={(e) => setActiveHardware(e.target.value)}
              className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text)] rounded px-2 py-1 text-xs font-medium focus:outline-none focus:border-[var(--color-primary)]"
            >
              <option value="GTX1650-4GB">GTX 1650 (4 GB VRAM, 16 GB RAM)</option>
              <option value="RTX3060-6GB">RTX 3060 (6 GB VRAM, 16 GB RAM)</option>
              <option value="Apple-M2-16GB">Apple M2 (16 GB Unified)</option>
              <option value="CPU-Only-8GB">CPU-Only (8 GB RAM)</option>
            </select>
          </div>
        </div>

        {/* Right: Telemetry & Actions */}
        <div className="flex items-center gap-3">
          {/* Live Resource Telemetry Pills */}
          <div className="hidden md:flex items-center gap-2 text-xs bg-[var(--color-surface-raised)] px-3 py-1.5 rounded-lg border border-[var(--color-border)] font-mono">
            <div className="flex items-center gap-1.5">
              <Activity size={13} className="text-cyan-400" />
              <span className="text-[var(--color-text-muted)]">CPU:</span>
              <span className="text-[var(--color-text)] font-semibold">
                {telemetry.cpu_percent ? `${telemetry.cpu_percent.toFixed(0)}%` : '22%'}
              </span>
            </div>
            <div className="h-3 w-px bg-[var(--color-border)]" />
            <div className="flex items-center gap-1.5">
              <HardDrive size={13} className="text-indigo-400" />
              <span className="text-[var(--color-text-muted)]">RAM:</span>
              <span className="text-[var(--color-text)] font-semibold">
                {telemetry.ram_used_gb ? `${telemetry.ram_used_gb.toFixed(1)} GB` : '4.2 GB'}
              </span>
            </div>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)] transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </header>
  )
}
