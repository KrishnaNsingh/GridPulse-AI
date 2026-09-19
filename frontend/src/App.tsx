import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataFieldBackground } from './components/DataFieldBackground';
import { SpotlightNavbar } from './components/SpotlightNavbar';
import LandingPage from './pages/Landing';
import DashboardPage from './pages/Dashboard';
import OptimizerPage from './pages/Optimizer';
import DigitalTwinPage from './pages/DigitalTwin';
import SimulatorPage from './pages/Simulator';
import BacktestPage from './pages/Backtest';
import AnalyticsPage from './pages/Analytics';
import AssistantPage from './pages/Assistant';
import SettingsPage from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
