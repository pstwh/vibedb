import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getGeminiApiKey, setGeminiApiKey, clearGeminiApiKey } from '@/lib/storage/localStorage';

type ApiKeyContextValue = {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
};

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    const existing = getGeminiApiKey();
    if (existing) setApiKeyState(existing);
  }, []);

  const setApiKey = (key: string) => {
    setGeminiApiKey(key);
    setApiKeyState(key);
  };

  const clearApiKey = () => {
    clearGeminiApiKey();
    setApiKeyState(null);
  };

  const value = useMemo(() => ({ apiKey, setApiKey, clearApiKey }), [apiKey]);

  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
};

export const useApiKeyContext = () => {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKeyContext must be used within ApiKeyProvider');
  return ctx;
};


