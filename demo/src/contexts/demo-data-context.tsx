'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { mockServices as initialMockServices } from '@/data/mock-data';

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive: boolean;
  depositOverride: number | null;
}

interface DemoDataContextValue {
  services: Service[];
  updateService: (serviceId: string, updates: { name?: string; price?: number; duration?: number }) => void;
}

const DemoDataContext = createContext<DemoDataContextValue | null>(null);

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [services, setServices] = useState<Service[]>(initialMockServices);

  const updateService = useCallback((serviceId: string, updates: { name?: string; price?: number; duration?: number }) => {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, ...updates } : s))
    );
  }, []);

  return (
    <DemoDataContext.Provider value={{ services, updateService }}>
      {children}
    </DemoDataContext.Provider>
  );
}

export function useDemoData() {
  const context = useContext(DemoDataContext);
  if (!context) {
    throw new Error('useDemoData must be used within a DemoDataProvider');
  }
  return context;
}
