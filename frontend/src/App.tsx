import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { DataFieldBackground } from './components/DataFieldBackground';
import { SpotlightNavbar } from './components/SpotlightNavbar';
import { Preloader } from './components/Preloader';
import LandingPage from './pages/Landing';
import DashboardPage from './pages/Dashboard';
import OptimizerPage from './pages/Optimizer';
import DigitalTwinPage from './pages/DigitalTwin';
import SimulatorPage from './pages/Simulator';
import BacktestPage from './pages/Backtest';
import AnalyticsPage from './pages/Analytics';
import AssistantPage from './pages/Assistant';
import SettingsPage from './pages/Settings';
import { AssistantProvider, useAssistant } from './context/AssistantContext';
import { BatteryProvider } from './context/BatteryContext';

function AssistantUrlSync() {
  const location = useLocation();
  const { openAssistant } = useAssistant();

  useEffect(() => {
    if (location.pathname === '/assistant') {
      openAssistant('fullscreen');
    }
  }, [location.pathname]);

  return null;
}

function AppContent() {
  const [showPreloader, setShowPreloader] = useState(true);

  return (
    <BrowserRouter>
      <AssistantUrlSync />
      <Preloader isLoading={showPreloader} onComplete={() => setShowPreloader(false)} />
      <DataFieldBackground />
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        <SpotlightNavbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/optimizer" element={<OptimizerPage />} />
          <Route path="/digital-twin" element={<DigitalTwinPage />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/assistant" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global Assistant Widget (Compact Side Panel & Fullscreen Expansive Mode) */}
        <AssistantPage />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <BatteryProvider>
      <AssistantProvider>
        <AppContent />
      </AssistantProvider>
    </BatteryProvider>
  );
}
