import type { ReactNode } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-800 bg-neutral-900 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-neutral-100">{title}</h3>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-800 ${className}`} />;
}

export function LoadingState({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-500">
      <RefreshCw className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-neutral-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-neutral-500">{message}</div>
  );
}

export function Badge({ children, color = 'neutral' }: { children: ReactNode; color?: 'neutral' | 'green' | 'red' | 'blue' | 'amber' }) {
  const colors: Record<string, string> = {
    neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    green: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
    red: 'bg-red-900/40 text-red-400 border-red-800',
    blue: 'bg-sky-900/40 text-sky-400 border-sky-800',
    amber: 'bg-amber-900/40 text-amber-400 border-amber-800',
  };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <RefreshCw className={`h-4 w-4 animate-spin ${className}`} />;
}
