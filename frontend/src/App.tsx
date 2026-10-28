import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

// Pages
import { Dashboard } from '@/pages/Dashboard'
import { CorpusPage } from '@/pages/CorpusPage'
import { ExperimentsPage } from '@/pages/ExperimentsPage'
import { MonitorPage } from '@/pages/MonitorPage'
import { PlaygroundPage } from '@/pages/PlaygroundPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { ParetoPage } from '@/pages/ParetoPage'
import { ReliabilityPage } from '@/pages/ReliabilityPage'
import { ReproPage } from '@/pages/ReproPage'
import { SettingsPage } from '@/pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export default function App() {
  const { theme } = useAppStore()

  useEffect(() => {
    // Apply dark / light class to root
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-screen w-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
          {/* Collapsible Left Navigation Bar */}
          <Sidebar />

          {/* Main App Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top Bar with Demo Ribbon and Telemetry */}
            <Header />

            {/* Scrollable Viewport */}
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/corpus" element={<CorpusPage />} />
                <Route path="/experiments" element={<ExperimentsPage />} />
                <Route path="/monitor" element={<MonitorPage />} />
                <Route path="/playground" element={<PlaygroundPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/pareto" element={<ParetoPage />} />
                <Route path="/reliability" element={<ReliabilityPage />} />
                <Route path="/repro" element={<ReproPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
