/**
 * Small helpers around the Cloudflare runtime that degrade to no-ops elsewhere
 * (Node tests, local scripts).
 *
 * - `keepAlive` extends the current request so background refreshes can finish
 *   after the response has been sent (ctx.waitUntil).
 * - `edgeGet` / `edgePut` store JSON in the colo-wide Cache API, which every
 *   Worker isolate in a data center shares. In-memory caches alone are lost each
 *   time Cloudflare starts a fresh isolate, which is what made cold page loads
 *   wait on every upstream provider.
 */

type Runtime = { waitUntil?: (promise: Promise<unknown>) => void };

let runtime: Runtime | null = null;
// Resolved once at module load so keepAlive can be called synchronously later.
const runtimeReady: Promise<Runtime> = import(/* @vite-ignore */ 'cloudflare:workers' as string)
  .then((mod) => (runtime = mod as Runtime))
  .catch(() => (runtime = {}));

export function keepAlive(promise: Promise<unknown>): void {
  const safe = promise.catch(() => {});
  const register = (r: Runtime) => {
    try {
      r.waitUntil?.(safe);
    } catch {
      // Called outside a request context: nothing to extend.
    }
  };
  if (runtime) register(runtime);
  else runtimeReady.then(register);
}

const CACHE_ORIGIN = 'https://sportivo.dipeshsapkota7.com.np/__edge-cache/';

function edgeCache(): Cache | null {
  const store = (globalThis as any).caches?.default as Cache | undefined;
  return store && typeof store.match === 'function' ? store : null;
}

export async function edgeGet<T>(key: string): Promise<T | null> {
  const cache = edgeCache();
  if (!cache) return null;
  try {
    const res = await cache.match(CACHE_ORIGIN + key);
    return res ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function edgePut(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const cache = edgeCache();
  if (!cache) return;
  try {
    await cache.put(
      CACHE_ORIGIN + key,
      new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttlSeconds}` },
      })
    );
  } catch {
    // Cache API unavailable (e.g. *.workers.dev): memory cache still applies.
  }
}

/** Resolves with `fallback` if `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}
