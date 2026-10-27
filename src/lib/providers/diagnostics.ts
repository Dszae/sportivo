/**
 * Privacy-conscious server-side diagnostic logging.
 * Logs provider resolution performance and error diagnostics without leaking secrets or credentials.
 */

export interface DiagnosticLogEvent {
  provider: string;
  operation: string;
  durationMs: number;
  status: number | string;
  contentType?: string;
  error?: string;
}

export function logDiagnostic(event: DiagnosticLogEvent): void {
  // Never log in client bundle, only on server/node
  if (typeof window !== 'undefined') return;

  const logPayload = {
    tag: '[Sportivo:ProviderDiagnostic]',
    timestamp: new Date().toISOString(),
    provider: event.provider,
    operation: event.operation,
    durationMs: Math.round(event.durationMs),
    status: event.status,
    ...(event.contentType ? { contentType: event.contentType } : {}),
    ...(event.error ? { error: event.error.replace(/[?&]key=[^&]+/gi, '?key=[REDACTED]') } : {}),
  };

  if (typeof event.status === 'number' && event.status >= 400) {
    console.warn(JSON.stringify(logPayload));
  } else {
    // Info log in development/testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(JSON.stringify(logPayload));
    }
  }
}

