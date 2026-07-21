import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';

type ScrollToTopFn = () => void;

interface ScrollToTopContextValue {
  register: (tabName: string, fn: ScrollToTopFn) => () => void;
  trigger: (tabName: string) => void;
}

const ScrollToTopContext = createContext<ScrollToTopContextValue>({
  register: () => () => {},
  trigger: () => {},
});

export function ScrollToTopProvider({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<Map<string, ScrollToTopFn>>(new Map());

  const register = useCallback((tabName: string, fn: ScrollToTopFn) => {
    mapRef.current.set(tabName, fn);
    return () => {
      mapRef.current.delete(tabName);
    };
  }, []);

  const trigger = useCallback((tabName: string) => {
    mapRef.current.get(tabName)?.();
  }, []);

  return (
    <ScrollToTopContext.Provider value={{ register, trigger }}>
      {children}
    </ScrollToTopContext.Provider>
  );
}

export function useScrollToTopRegister(tabName: string, fn: ScrollToTopFn) {
  const { register } = useContext(ScrollToTopContext);
  useEffect(() => {
    return register(tabName, fn);
  }, [tabName, fn, register]);
}

export function useScrollToTopTrigger() {
  return useContext(ScrollToTopContext).trigger;
}
