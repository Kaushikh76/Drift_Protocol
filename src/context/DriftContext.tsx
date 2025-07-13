import React, { createContext, useContext, ReactNode } from 'react';
import { DriftConfig } from '../types';

interface DriftContextType {
  config: DriftConfig;
}

const DriftContext = createContext<DriftContextType | undefined>(undefined);

interface DriftProviderProps {
  config: DriftConfig;
  children: ReactNode;
}

export const DriftProvider: React.FC<DriftProviderProps> = ({ config, children }) => {
  return (
    <DriftContext.Provider value={{ config }}>
      {children}
    </DriftContext.Provider>
  );
};

export const useDrift = (): DriftContextType => {
  const context = useContext(DriftContext);
  if (!context) {
    throw new Error('useDrift must be used within a DriftProvider');
  }
  return context;
};