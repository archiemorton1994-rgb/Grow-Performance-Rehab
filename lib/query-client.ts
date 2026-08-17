import { fetch } from 'expo/fetch';
import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { getAuthToken } from './auth-token';

/**
 * Gets the base URL for the Express API server (e.g., "http://localhost:3000")
 * @returns {string} The API base URL
 */
export function getApiUrl(): string {
  const host = process.env.EXPO_PUBLIC_DOMAIN || 'grow-performance-rehab.replit.app';
  return new URL(`https://${host}`).href;
}

/** An HTTP failure, carrying the status so callers can tell 401 from 502. */
export interface ApiError extends Error {
  status?: number;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // The status is also in the message as an "NNN: " prefix, which callers used
    // to have to parse back out of a string. Carrying it as a field lets the
    // launch path tell "this token is invalid" (401) from "the server is asleep
    // or the phone is on the Underground" (5xx, or no response at all) — the
    // difference between correctly signing someone out and wrongly doing so.
    const err = new Error(`${res.status}: ${text}`) as ApiError;
    err.status = res.status;
    throw err;
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {};
  if (data) headers['Content-Type'] = 'application/json';
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join('/') as string, baseUrl);

    const res = await fetch(url.toString(), {
      credentials: 'include',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
