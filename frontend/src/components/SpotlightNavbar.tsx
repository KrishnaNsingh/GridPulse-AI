import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { animate } from 'framer-motion';
import { Zap } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Optimizer', href: '/optimizer' },
  { label: 'Digital Twin', href: '/digital-twin' },
  { label: 'Simulator', href: '/simulator' },
  { label: 'Backtest', href: '/backtest' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'AI Assistant', href: '/assistant' },
  { label: 'Settings', href: '/settings' },
];

export function SpotlightNavbar() {
  const navRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const activeIndex = NAV_ITEMS.findIndex(item => {
    if (item.href === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.href);
  });
  const [currentActive, setCurrentActive] = useState(Math.max(0, activeIndex));
  const [hoverX, setHoverX] = useState<number | null>(null);

  const spotlightX = useRef(0);
  const ambienceX = useRef(0);

  useEffect(() => {
    const idx = NAV_ITEMS.findIndex(item => {
      if (item.href === '/') return location.pathname === '/';
      return location.pathname.startsWith(item.href);
    });
    if (idx >= 0) setCurrentActive(idx);
  }, [location.pathname]);

  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = nav.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverX(x);
      spotlightX.current = x;
      nav.style.setProperty('--spotlight-x', `${x}px`);
    };

    const handleMouseLeave = () => {
      setHoverX(null);
      const activeEl = nav.querySelector(`[data-index="${currentActive}"]`);
      if (activeEl) {
        const navRect = nav.getBoundingClientRect();
        const itemRect = activeEl.getBoundingClientRect();
        const targetX = itemRect.left - navRect.left + itemRect.width / 2;
        animate(spotlightX.current, targetX, {
          type: 'spring', stiffness: 200, damping: 20,
          onUpdate: (v) => {
            spotlightX.current = v;
            nav.style.setProperty('--spotlight-x', `${v}px`);
          }
        });
      }
    };

    nav.addEventListener('mousemove', handleMouseMove);
    nav.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      nav.removeEventListener('mousemove', handleMouseMove);
      nav.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [currentActive]);

  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;
    const activeEl = nav.querySelector(`[data-index="${currentActive}"]`);
    if (activeEl) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      const targetX = itemRect.left - navRect.left + itemRect.width / 2;
      animate(ambienceX.current, targetX, {
        type: 'spring', stiffness: 200, damping: 20,
        onUpdate: (v) => {
          ambienceX.current = v;
          nav.style.setProperty('--ambience-x', `${v}px`);
        }
      });
    }
  }, [currentActive]);

  const handleClick = (item: typeof NAV_ITEMS[0], idx: number) => {
    setCurrentActive(idx);
    navigate(item.href);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      background: 'rgba(7, 11, 20, 0.8)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(31, 45, 69, 0.8)',
    }}>
      {/* Logo */}
      <button
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, #1d4ed8, #0891b2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={16} color="white" />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff', letterSpacing: '-0.02em' }}>
          GridPilot <span style={{ color: '#3b82f6' }}>AI</span>
        </span>
      </button>

      {/* Spotlight Navbar */}
      <div
        ref={navRef}
        style={{
          position: 'relative',
          height: 40,
          borderRadius: 100,
          background: 'rgba(17, 24, 39, 0.9)',
          border: '1px solid rgba(31, 45, 69, 0.9)',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Spotlight light */}
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute', bottom: 0, left: 0,
            width: '100%', height: '100%', zIndex: 1,
            opacity: hoverX !== null ? 1 : 0,
            transition: 'opacity 0.3s',
            background: 'radial-gradient(100px circle at var(--spotlight-x) 100%, rgba(255,255,255,0.07) 0%, transparent 60%)',
          }}
        />

        {/* Ambience line */}
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute', bottom: 0, left: 0,
            width: '100%', height: '2px', zIndex: 2,
            background: 'radial-gradient(50px circle at var(--ambience-x) 0%, rgba(59,130,246,1) 0%, transparent 100%)',
          }}
        />

        {/* Nav items */}
        <ul style={{
          position: 'relative', zIndex: 10,
          display: 'flex', alignItems: 'center',
          height: '100%', padding: '0 6px', margin: 0,
          gap: 0, listStyle: 'none',
        }}>
          {NAV_ITEMS.map((item, idx) => (
            <li key={idx} style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
              <button
                data-index={idx}
                onClick={() => handleClick(item, idx)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 500,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'color 0.2s',
                  color: currentActive === idx ? '#f0f4ff' : '#6b7280',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (currentActive !== idx) (e.target as HTMLElement).style.color = '#d1d5db'; }}
                onMouseLeave={e => { if (currentActive !== idx) (e.target as HTMLElement).style.color = '#6b7280'; }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="status-dot optimal" />
        <span style={{ fontSize: 12, color: '#6b7280', display: 'none' }} id="system-status">
          System Ready
        </span>
      </div>
    </div>
  );
}
