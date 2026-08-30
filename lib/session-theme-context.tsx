/**
 * Putting the session's colour on the screen. The derivation is in
 * session-theme.ts; this is only the plumbing that gets it to a component.
 *
 * A context rather than a prop because the session screen's pieces are nested
 * four deep in places - a timer inside a card inside a scroller - and threading
 * a colour through every one of them is how a screen ends up with one panel
 * that never got the message. That panel is exactly what was reported.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColors, useIsDarkTheme, type AppColors } from '@/constants/colors';
import { GO, sessionColorOverrides } from './session-theme';
import type { SessionType } from './store';

const SessionThemeContext = createContext<SessionType | string | null>(null);

/** Everything rendered inside this is coloured for `type`. */
export function SessionThemeProvider({
  type,
  children,
}: {
  type: SessionType | string | undefined;
  children: React.ReactNode;
}) {
  return (
    <SessionThemeContext.Provider value={type ?? null}>{children}</SessionThemeContext.Provider>
  );
}

/**
 * The colour set, in the session's hue.
 *
 * Pass a type to colour a screen that is not inside a provider - readiness does
 * that, because it knows which session it is asking about before the session
 * exists. With no type and no provider this is exactly `useColors()`, so it is
 * safe in a component that renders both inside and outside a session.
 */
export function useSessionColors(type?: SessionType | string): AppColors {
  const base = useColors();
  const isDark = useIsDarkTheme();
  const fromContext = useContext(SessionThemeContext);
  const resolved = type ?? fromContext;
  return useMemo(
    () => (resolved ? { ...base, ...sessionColorOverrides(base, resolved, isDark) } : base),
    [base, resolved, isDark]
  );
}

/**
 * The go button's colours for the current theme.
 *
 * The one thing on a session screen that is the same in every session.
 */
export function useGoColors(): { fill: string; on: string } {
  const isDark = useIsDarkTheme();
  return isDark ? GO.dark : GO.light;
}
