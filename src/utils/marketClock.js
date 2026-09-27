function toBool(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return undefined;
}

function inferIsOpen(timestamp, nextOpen, nextClose) {
  if (!timestamp || !nextOpen || !nextClose) return undefined;

  const t = new Date(timestamp).getTime();
  const openT = new Date(nextOpen).getTime();
  const closeT = new Date(nextClose).getTime();

  if (!Number.isFinite(t) || !Number.isFinite(openT) || !Number.isFinite(closeT)) {
    return undefined;
  }

  // Regular session: next_close is today, next_open is a later session start.
  if (openT > closeT) {
    return t < closeT;
  }

  // Market closed (e.g. weekend): next_open and next_close refer to the same upcoming session.
  return t >= openT && t < closeT;
}

export function normalizeMarketClockPayload(raw) {
  const source =
    raw && typeof raw === "object" && raw.clock && typeof raw.clock === "object"
      ? raw.clock
      : raw;

  if (!source || typeof source !== "object") {
    return { is_open: false };
  }

  const timestamp = source.timestamp ?? source.market_time ?? null;
  const nextOpen = source.next_open ?? source.nextOpen ?? null;
  const nextClose = source.next_close ?? source.nextClose ?? null;

  let isOpen = toBool(source.is_open ?? source.isOpen);
  if (typeof isOpen !== "boolean") {
    isOpen = inferIsOpen(timestamp, nextOpen, nextClose);
  }
  if (typeof isOpen !== "boolean") {
    isOpen = false;
  }

  return {
    timestamp: timestamp ?? undefined,
    is_open: isOpen,
    next_open: nextOpen ?? undefined,
    next_close: nextClose ?? undefined,
    session: source.session ?? undefined,
    market_time: source.market_time ?? timestamp ?? undefined,
  };
}
