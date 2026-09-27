import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ToastProvider } from '@/components/common/Toast';
import { Dashboard } from '@/pages/Dashboard';
import { Markets } from '@/pages/Markets';
import { AssetDetails } from '@/pages/AssetDetails';
import { Portfolio } from '@/pages/Portfolio';
import { Orders } from '@/pages/Orders';
import { Watchlists } from '@/pages/Watchlists';
import { Settings } from '@/pages/Settings';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/markets/:symbol" element={<AssetDetails />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/watchlists" element={<Watchlists />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
