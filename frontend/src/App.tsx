import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { Tour } from "./components/Tour";
import { HelpDrawer } from "./components/HelpDrawer";

// 7 Pages
import { Home } from "./pages/Home";
import { Guide } from "./pages/Guide";
import { Models } from "./pages/Models";
import { Benchmark } from "./pages/Benchmark";
import { Results } from "./pages/Results";
import { Recommend } from "./pages/Recommend";
import { TryIt } from "./pages/TryIt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const [isTourOpen, setIsTourOpen] = useState(() => {
    return !localStorage.getItem("pramaan_tour_seen");
  });
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleCloseTour = () => {
    setIsTourOpen(false);
    localStorage.setItem("pramaan_tour_seen", "true");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen flex flex-col bg-paper text-ink font-body">
          <Header onOpenHelp={() => setIsHelpOpen(true)} />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home onStartTour={() => setIsTourOpen(true)} />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/models" element={<Models />} />
              <Route path="/benchmark" element={<Benchmark />} />
              <Route path="/results" element={<Results />} />
              <Route path="/recommend" element={<Recommend />} />
              <Route path="/try-it" element={<TryIt />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />

          {/* Tour and Help Drawer */}
          <Tour isOpen={isTourOpen} onClose={handleCloseTour} />
          <HelpDrawer
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
            onStartTour={() => setIsTourOpen(true)}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
