import { useId, useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTipProps {
  label: string;
  text?: string;
}

export function InfoTip({ label, text }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const content = text || 'Metric definition unavailable.';

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={`Information about ${label}`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="ml-1 rounded-full p-0.5 text-sky-400/80 hover:bg-sky-950/40 hover:text-sky-300"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-left text-xs leading-relaxed text-neutral-200 shadow-xl"
        >
          <span className="mb-1 block font-semibold text-sky-300">{label}</span>
          {content}
        </span>
      )}
    </span>
  );
}
