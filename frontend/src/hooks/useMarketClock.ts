import { useEffect, useState } from 'react';
import { getMarketClock, type MarketClock } from '@/services/api';

export function useMarketClock() {
  const [clock, setClock] = useState<MarketClock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClock = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMarketClock();
      if (!data) {
        setError('Unable to read market clock.');
        setClock(null);
      } else {
        setClock(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load market status.');
      setClock(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClock();
    const interval = setInterval(fetchClock, 30000);
    return () => clearInterval(interval);
  }, []);

  return { clock, loading, error, refetch: fetchClock };
}
