import express from "express";

import accountRouter from "./routers/account.routes.js";
import ordersRouter from "./routers/orders.routes.js";
import optionsRouter from "./routers/options.routes.js";
import marketRouter from "./routers/market.routes.js";
import watchlistRouter from "./routers/watchlist.routes.js";
import assetsRouter from "./routers/assets.routes.js";
import analysisRouter from "./routers/analysis.routes.js";

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

app.use("/api/account", accountRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/options", optionsRouter);
app.use("/api/market", marketRouter);
app.use("/api/watchlists", watchlistRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/analysis", analysisRouter);

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

export default app;