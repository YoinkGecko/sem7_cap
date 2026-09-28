import { AccountSummaryCards } from '@/components/dashboard/AccountSummaryCards';
import { HoldingsTable } from '@/components/dashboard/HoldingsTable';
import { PortfolioChart } from '@/components/dashboard/PortfolioChart';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { WatchlistPreview } from '@/components/dashboard/WatchlistPreview';

export function Dashboard() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Account overview and market summary</p>
      </div>
      <AccountSummaryCards />
      <HoldingsTable />
      <PortfolioChart />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MarketOverview />
        <WatchlistPreview />
      </div>
    </div>
  );
}
