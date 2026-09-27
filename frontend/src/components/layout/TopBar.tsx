import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Menu } from 'lucide-react';
import { useMarketClock } from '@/hooks/useMarketClock';
import { fmtMarketTimeEt } from '@/utils/format';
import { marketStatusLabel } from '@/utils/marketData';

interface TopBarProps {
  onMobileMenu: () => void;
}

export function TopBar({ onMobileMenu }: TopBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const { clock, loading } = useMarketClock();
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = clock?.is_open === true;
  const statusKnown = !loading && clock != null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim().toUpperCase();
    if (q) {
      navigate(`/markets/${q}`);
      setQuery('');
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <header className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-4 py-2.5">
      <button
        onClick={onMobileMenu}
        className="lg:hidden rounded p-1 text-neutral-400 hover:bg-neutral-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <TrendingUp className="h-5 w-5 text-sky-400" />
      </div>

      <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search symbol..."
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-1.5 pl-9 pr-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-sky-700 focus:outline-none"
        />
        {focused && query.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-md border border-neutral-800 bg-neutral-900 py-1 shadow-lg z-50">
            <button
              type="button"
              onMouseDown={() => {
                navigate(`/markets/${query.trim().toUpperCase()}`);
                setQuery('');
                inputRef.current?.blur();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
            >
              <Search className="h-3.5 w-3.5 text-neutral-500" />
              View <span className="font-semibold text-neutral-100">{query.trim().toUpperCase()}</span>
            </button>
          </div>
        )}
      </form>

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              loading
                ? 'bg-amber-400 animate-pulse'
                : isOpen
                  ? 'bg-emerald-400 animate-pulse'
                  : statusKnown
                    ? 'bg-neutral-600'
                    : 'bg-amber-500'
            }`}
          />
          <div className="text-xs max-w-[14rem] sm:max-w-none">
            <span
              className={`font-medium ${
                loading
                  ? 'text-neutral-400'
                  : isOpen
                    ? 'text-emerald-400'
                    : statusKnown
                      ? 'text-neutral-400'
                      : 'text-amber-400'
              }`}
            >
              {marketStatusLabel(clock, loading)}
            </span>
            {statusKnown && !isOpen && clock?.next_open && (
              <span className="text-neutral-600 ml-1.5 hidden sm:inline">
                · Opens {fmtMarketTimeEt(clock.next_open)}
              </span>
            )}
            {statusKnown && isOpen && clock?.next_close && (
              <span className="text-neutral-600 ml-1.5 hidden sm:inline">
                · Closes {fmtMarketTimeEt(clock.next_close)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-neutral-800 pl-4">
          <div className="h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-semibold text-neutral-300">
            TR
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-neutral-200">Trader</p>
            <p className="text-xs text-neutral-500">Paper Account</p>
          </div>
        </div>
      </div>
    </header>
  );
}
