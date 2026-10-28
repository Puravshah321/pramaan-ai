import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, FlaskConical, Activity,
  MessageSquare, BarChart3, GitBranch, ShieldCheck,
  RefreshCcw, Settings, ChevronLeft, ChevronRight, Zap
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

const NAV_ITEMS = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/corpus',        icon: FolderOpen,       label: 'Corpus & Data' },
  { to: '/experiments',   icon: FlaskConical,     label: 'Experiments' },
  { to: '/monitor',       icon: Activity,          label: 'Run Monitor' },
  { to: '/playground',   icon: MessageSquare,     label: 'Playground' },
  { to: '/results',      icon: BarChart3,         label: 'Results' },
  { to: '/pareto',       icon: GitBranch,         label: 'Pareto & Decision' },
  { to: '/reliability',  icon: ShieldCheck,       label: 'Reliability Lab' },
  { to: '/repro',        icon: RefreshCcw,        label: 'Reproducibility' },
  { to: '/settings',     icon: Settings,          label: 'Settings' },
]

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  return (
    <aside
      className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
          <ShieldCheck size={18} className="text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-sm font-bold text-[var(--color-text)]">Pramaan AI</div>
            <div className="text-[10px] text-[var(--color-text-muted)] leading-tight">
              Evidence for every answer.
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Pages">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="flex items-center justify-center w-full py-3 border-t border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!sidebarCollapsed && <span className="ml-2 text-xs">Collapse</span>}
      </button>
    </aside>
  )
}
