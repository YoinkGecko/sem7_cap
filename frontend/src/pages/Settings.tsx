import { Card, CardHeader } from '@/components/common/UI';

export function Settings() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">Settings</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Application preferences</p>
      </div>
      <Card>
        <CardHeader title="API Configuration" subtitle="Backend connection settings" />
        <div className="p-4 space-y-3">
          <div>
            <p className="text-xs text-neutral-500">API Base URL</p>
            <p className="mt-1 text-sm text-neutral-200">
              {import.meta.env.VITE_API_BASE_URL ||
                (import.meta.env.DEV ? '/api' : 'http://localhost:3000/api')}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Environment</p>
            <p className="mt-1 text-sm text-neutral-200">{import.meta.env.MODE}</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="News (Gemini)" subtitle="Configured on the server" />
        <div className="p-4 space-y-2 text-sm text-neutral-400">
          <p>
            Stock news on each symbol page is fetched through the backend using the free Google Gemini API (with optional
            Google Search grounding).
          </p>
          <p>
            Add <code className="text-neutral-300">GEMINI_API_KEY</code> to the server{' '}
            <code className="text-neutral-300">.env</code> file (see <code className="text-neutral-300">.env.example</code>
            ), then restart <code className="text-neutral-300">npm run dev</code> in the server folder.
          </p>
          <p>
            If you hit Gemini quota errors, set <code className="text-neutral-300">NEWS_PROVIDER=alpaca</code> or keep{' '}
            <code className="text-neutral-300">NEWS_PROVIDER=auto</code> to fall back to Alpaca news automatically.
          </p>
          <p className="text-xs text-neutral-500">
            Get a free key at{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-400 hover:text-sky-300"
            >
              Google AI Studio
            </a>
            . Never put the key in the frontend.
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader title="About" />
        <div className="p-4">
          <p className="text-sm text-neutral-400">
            TradeTerm is a paper trading terminal frontend built for Semester 7. It communicates with an existing
            Node.js + Express REST API that wraps the Alpaca trading API. No backend logic runs in this app.
          </p>
        </div>
      </Card>
    </div>
  );
}
