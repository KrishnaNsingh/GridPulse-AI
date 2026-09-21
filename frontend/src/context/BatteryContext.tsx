import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { BatteryConfig, BatteryState } from '../types';
import { getBatteryConfig, saveBatteryConfig as apiSaveBatteryConfig } from '../services/api';

export const DEFAULT_BATTERY_CONFIG: BatteryConfig = {
  name: 'Demo BESS — 10 MWh / 2.5 MW',
  capacity_mwh: 10,
  power_mw: 2.5,
  efficiency_charge: 0.95,
  efficiency_discharge: 0.95,
  soc_min: 0.1,
  soc_max: 0.9,
  soc_initial: 0.5,
  soc_terminal: null,
  degradation_cost_per_mwh: 5.0,
  reserve_level: 0.0,
};

export const DEFAULT_BATTERY_STATE: BatteryState = {
  soc: 0.5,
  energy_mwh: 5.0,
  action: 'idle',
  charge_power_mw: 0,
  discharge_power_mw: 0,
  cycle_count: 0,
  total_degradation_cost: 0,
  total_revenue: 0,
  total_energy_cost: 0,
};

interface BatteryContextValue {
  config: BatteryConfig;
  batteryState: BatteryState;
  isLoaded: boolean;
  updateConfig: (updates: Partial<BatteryConfig>) => void;
  saveConfig: (newConfig?: BatteryConfig) => Promise<BatteryConfig>;
  setBatteryState: React.Dispatch<React.SetStateAction<BatteryState>>;
  updateBatteryState: (updates: Partial<BatteryState>) => void;
  refreshConfig: () => Promise<BatteryConfig>;
}

const BatteryContext = createContext<BatteryContextValue | null>(null);

export function BatteryProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BatteryConfig>(DEFAULT_BATTERY_CONFIG);
  const [batteryState, setBatteryState] = useState<BatteryState>(DEFAULT_BATTERY_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load initial battery configuration from database
  const refreshConfig = useCallback(async (): Promise<BatteryConfig> => {
    try {
      const fetched = await getBatteryConfig();
      if (fetched) {
        setConfig(fetched);
        setBatteryState(prev => ({
          ...prev,
          soc: fetched.soc_initial ?? prev.soc,
          energy_mwh: Number(((fetched.soc_initial ?? prev.soc) * (fetched.capacity_mwh ?? 10)).toFixed(2)),
        }));
        setIsLoaded(true);
        return fetched;
      }
    } catch (err) {
      console.warn('[BatteryContext] Failed to load battery config from backend, using defaults:', err);
    }
    setIsLoaded(true);
    return DEFAULT_BATTERY_CONFIG;
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Update in-memory configuration immediately (propagates to all views)
  const updateConfig = useCallback((updates: Partial<BatteryConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };

      // Synchronize batteryState if soc_initial or capacity_mwh changed
      if (updates.soc_initial !== undefined || updates.capacity_mwh !== undefined) {
        const newCap = updated.capacity_mwh ?? 10;
        setBatteryState(s => {
          const newSoc = updates.soc_initial !== undefined ? updates.soc_initial : s.soc;
          return {
            ...s,
            soc: newSoc,
            energy_mwh: Number((newSoc * newCap).toFixed(2)),
          };
        });
      }

      return updated;
    });
  }, []);

  // Save configuration to backend database and sync
  const saveConfig = useCallback(async (newConfig?: BatteryConfig): Promise<BatteryConfig> => {
    const toSave = newConfig || config;
    const res = await apiSaveBatteryConfig(toSave);
    if (res) {
      setConfig(res);
      setBatteryState(s => ({
        ...s,
        soc: res.soc_initial ?? s.soc,
        energy_mwh: Number(((res.soc_initial ?? s.soc) * (res.capacity_mwh ?? 10)).toFixed(2)),
      }));
      return res;
    }
    return toSave;
  }, [config]);

  const updateBatteryState = useCallback((updates: Partial<BatteryState>) => {
    setBatteryState(prev => ({ ...prev, ...updates }));
  }, []);

  const value: BatteryContextValue = {
    config,
    batteryState,
    isLoaded,
    updateConfig,
    saveConfig,
    setBatteryState,
    updateBatteryState,
    refreshConfig,
  };

  return <BatteryContext.Provider value={value}>{children}</BatteryContext.Provider>;
}

export function useBattery(): BatteryContextValue {
  const ctx = useContext(BatteryContext);
  if (!ctx) {
    throw new Error('useBattery must be used within a BatteryProvider');
  }
  return ctx;
}
