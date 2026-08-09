'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[NEXUS Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. This has been logged to the console.
          Try refreshing the page or click the button below to reset.
        </p>
        {error.message && (
          <pre className="mt-4 rounded-lg bg-card border border-border p-3 text-left text-xs text-muted-foreground overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
      </div>
      <Button
        onClick={reset}
        className="gap-2 bg-violet-600 hover:bg-violet-500 text-white"
      >
        <RotateCcw className="h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
}
