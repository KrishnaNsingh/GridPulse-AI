import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KineticTextLoader } from '@/components/ui/kinetic-text-loader';
import { Zap, Cpu, ShieldCheck } from 'lucide-react';

export interface PreloaderProps {
  /**
   * Whether the preloader is currently active.
   * If undefined, the preloader runs automatically for `duration` ms.
   */
  isLoading?: boolean;
  /**
   * Callback fired when preloader sequence completes and exit transition ends.
   */
  onComplete?: () => void;
  /**
   * Minimum duration in ms before auto-completing (default: 2200ms).
   */
  duration?: number;
  /**
   * Brand title shown above loader.
   */
  brandName?: string;
  /**
   * Subtitle / system info string.
   */
  systemTag?: string;
  /**
   * Whether to allow manual skipping.
   */
  canSkip?: boolean;
}

const SYSTEM_STAGES = [
  { progress: 18, text: 'Initializing GridPilot core architecture...', icon: Cpu },
  { progress: 46, text: 'Calibrating degradation-aware MILP solver...', icon: Zap },
  { progress: 78, text: 'Synchronizing real-time telemetry & digital twin...', icon: Cpu },
  { progress: 100, text: 'Autonomous energy arbitrage engine online.', icon: ShieldCheck },
];

export function Preloader({
  isLoading,
  onComplete,
  duration = 2200,
  brandName: _brandName = 'GRIDPILOT AI',
  systemTag: _systemTag = 'ENERGY ARBITRAGE & DISPATCH OS',
  canSkip = true,
}: PreloaderProps) {
  const [internalLoading, setInternalLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [stageIndex, setStageIndex] = useState(0);

  // Active state: if `isLoading` is explicitly passed, use it, else use internalLoading
  const active = isLoading !== undefined ? isLoading : internalLoading;

  useEffect(() => {
    if (!active) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct < 30) {
        setStageIndex(0);
      } else if (pct < 65) {
        setStageIndex(1);
      } else if (pct < 95) {
        setStageIndex(2);
      } else {
        setStageIndex(3);
      }

      if (elapsed >= duration) {
        clearInterval(interval);
        setTimeout(() => {
          setInternalLoading(false);
          onComplete?.();
        }, 300);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [active, duration, onComplete]);

  const handleDismiss = () => {
    if (!canSkip) return;
    setInternalLoading(false);
    onComplete?.();
  };

  const CurrentIcon = SYSTEM_STAGES[stageIndex]?.icon || Zap;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="gridpilot-preloader"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.02,
            filter: 'blur(10px)',
            transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
          }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            backgroundColor: '#070b14',
            backgroundImage: `
              radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59, 130, 246, 0.18), transparent 70%),
              radial-gradient(circle 500px at 50% 50%, rgba(6, 182, 212, 0.08), transparent 80%),
              radial-gradient(ellipse 60% 40% at 50% 110%, rgba(139, 92, 246, 0.15), transparent 70%)
            `,
          }}
        >
          {/* Subtle grid backdrop */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Ambient Glow Center */}
          <div className="absolute w-[360px] h-[360px] rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />

          {/* Main Content Container */}
          <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center">

            {/* Top Brand Pill */}
            {/* <motion.div 
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
              style={{
                backgroundColor: 'rgba(13, 19, 32, 0.8)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-mono font-bold tracking-widest text-cyan-400">
                {brandName}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                // {systemTag}
              </span>
            </motion.div> */}

            {/* Kinetic Text Loader */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="py-4 my-2"
            >
              <KineticTextLoader text="Loading" />
            </motion.div>

            {/* Progress Telemetry */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="w-full mt-6"
            >
              {/* Progress track */}
              <div
                className="w-full h-1.5 rounded-full overflow-hidden mb-3 relative"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-150 ease-out relative"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 50%, #10b981 100%)',
                    boxShadow: '0 0 12px rgba(6, 182, 212, 0.6)',
                  }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_#ffffff]" />
                </div>
              </div>

              {/* Status and Percentage Indicator */}
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <div className="flex items-center gap-1.5 text-left truncate max-w-[280px]">
                  <CurrentIcon size={13} className="text-cyan-400 shrink-0 animate-pulse" />
                  <span className="truncate text-[11px] text-neutral-300">
                    {SYSTEM_STAGES[stageIndex]?.text}
                  </span>
                </div>
                <span className="font-bold text-cyan-400 text-[11px] shrink-0">
                  {progress}%
                </span>
              </div>
            </motion.div>

            {/* Skip Option */}
            {canSkip && (
              <motion.button
                type="button"
                onClick={handleDismiss}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                whileHover={{ opacity: 1, scale: 1.05 }}
                transition={{ duration: 0.3, delay: 0.8 }}
                className="mt-8 text-[11px] font-mono text-neutral-400 tracking-wider hover:text-cyan-300 cursor-pointer bg-transparent border-none outline-none transition-colors"
              >
                CLICK OR ESC TO SKIP &rarr;
              </motion.button>
            )}

          </div>

          {/* Corner Cyber Accents */}
          <div className="absolute top-6 left-6 text-neutral-600 font-mono text-[10px] tracking-widest hidden sm:block">
            SYS: ONLINE // 48.0V BESS // 10MWh
          </div>
          <div className="absolute bottom-6 left-6 text-neutral-600 font-mono text-[10px] tracking-widest hidden sm:block">
            LATENCY: 12ms // TELEMETRY: SYNCED
          </div>
          <div className="absolute top-6 right-6 text-neutral-600 font-mono text-[10px] tracking-widest hidden sm:block">
            GRIDPILOT v2.4
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Preloader;
