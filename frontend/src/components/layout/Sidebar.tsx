import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CandlestickChart,
  Briefcase,
  ClipboardList,
  Star,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Bot,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: CandlestickChart },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/watchlists', label: 'Watchlists', icon: Star },
  { to: '/automated-trading', label: 'Auto Trading', icon: Bot },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`flex flex-col border-r border-neutral-800 bg-neutral-950 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className="flex items-center justify-between p-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-sky-400" />
            <span className="text-sm font-bold text-neutral-100">TradeTerm</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-900/30 text-sky-400'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-neutral-800 p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-sky-900/30 text-sky-400'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`
          }
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
