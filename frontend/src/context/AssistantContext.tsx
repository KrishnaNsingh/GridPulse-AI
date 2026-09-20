import { createContext, useContext, useState, ReactNode } from 'react';

export type AssistantMode = 'compact' | 'fullscreen';

interface AssistantContextType {
  isOpen: boolean;
  mode: AssistantMode;
  openAssistant: (targetMode?: AssistantMode) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  toggleMode: () => void;
  setMode: (mode: AssistantMode) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('compact');

  const openAssistant = (targetMode?: AssistantMode) => {
    if (targetMode) setMode(targetMode);
    setIsOpen(true);
  };

  const closeAssistant = () => {
    setIsOpen(false);
  };

  const toggleAssistant = () => {
    setIsOpen(prev => !prev);
  };

  const toggleMode = () => {
    setMode(prev => (prev === 'compact' ? 'fullscreen' : 'compact'));
  };

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        mode,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        toggleMode,
        setMode,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
