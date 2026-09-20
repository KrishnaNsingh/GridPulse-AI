import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, Activity, Cpu, ChevronRight, Shield, Bot } from 'lucide-react';

const FEATURES = [
  { icon: <Cpu size={20} />, title: 'MILP Optimization', desc: 'PuLP + HiGHS solver. Globally optimal dispatch over the planning horizon with degradation penalties.', color: '#3b82f6' },
  { icon: <TrendingUp size={20} />, title: 'LightGBM Forecast', desc: 'P10/P50/P90 quantile regression on historical prices with lag features and rolling statistics.', color: '#10b981' },
  { icon: <Activity size={20} />, title: 'MPC Closed-Loop', desc: 'Receding horizon controller. Re-optimizes at each timestep from actual state, incorporating new information.', color: '#f59e0b' },
  { icon: <Shield size={20} />, title: 'Constraint Verified', desc: 'Post-solve validation: SoC bounds, power limits, anti-simultaneity, terminal SoC, and physical asset limits.', color: '#8b5cf6' },
  { icon: <Bot size={20} />, title: 'Groq AI Explainer', desc: 'LLM receives real optimization context and explains dispatch decisions. Never overrides the solver.', color: '#06b6d4' },
  { icon: <Zap size={20} />, title: 'Degradation Model', desc: 'Piecewise tiered DoD model (1× to 8× penalty) discourages deep cycling without explicit battery rules.', color: '#f97316' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px 60px', position: 'relative', zIndex: 1 }}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ textAlign: 'center', maxWidth: 700, marginBottom: 60 }}
      >
        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(59,130,246,0.4)',
          }}>
            <Zap size={26} color="white" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f0f4ff', letterSpacing: '-0.03em', lineHeight: 1 }}>
              GridPulse <span style={{ color: '#3b82f6' }}>AI</span>
            </div>
            <div style={{ fontSize: 12, color: '#4a5a7a', marginTop: 3 }}>MaVionix Optimization Challenge · Problem 07</div>
          </div>
        </div>

        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 48px)',
          fontWeight: 800,
          color: '#f0f4ff',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          margin: '0 0 16px',
        }}>
          Degradation-Aware<br />
          <span style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Intelligent Battery Arbitrage
          </span>
        </h1>

        <p style={{ fontSize: 16, color: '#8b9bbf', lineHeight: 1.7, margin: '0 0 32px' }}>
          An enterprise BESS control platform. MILP optimization determines dispatch.
          LightGBM forecasts prices. MPC closes the loop. Groq explains decisions.
          <strong style={{ color: '#f0f4ff' }}> Deterministic mathematical dispatch.</strong>
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => navigate('/dashboard')}
            id="get-started-btn"
            style={{ padding: '12px 28px', fontSize: 15 }}
          >
            Open Dashboard <ChevronRight size={16} />
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate('/optimizer')}
            id="run-optimizer-btn"
            style={{ padding: '12px 28px', fontSize: 15 }}
          >
            <Cpu size={16} /> Run Optimizer
          </button>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          width: '100%',
          maxWidth: 960,
        }}
      >
        {FEATURES.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="card card-hover"
            style={{ position: 'relative', overflow: 'hidden' }}
          >
            {/* Top color bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: f.color, opacity: 0.7 }} />
            <div style={{ color: f.color, marginBottom: 10 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: '#8b9bbf', lineHeight: 1.6 }}>{f.desc}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Tech Stack */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{ marginTop: 48, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {['FastAPI', 'PuLP + HiGHS', 'LightGBM', 'SQLAlchemy', 'React + Vite', 'Recharts', 'Three.js', 'Groq'].map(t => (
          <span key={t} className="badge badge-info" style={{ fontSize: 10 }}>{t}</span>
        ))}
      </motion.div>
    </div>
  );
}
