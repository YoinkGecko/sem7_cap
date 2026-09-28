import express from "express";

import accountRouter from "./routers/account.routes.js";
import ordersRouter from "./routers/orders.routes.js";
import optionsRouter from "./routers/options.routes.js";
import marketRouter from "./routers/market.routes.js";
import watchlistRouter from "./routers/watchlist.routes.js";
import assetsRouter from "./routers/assets.routes.js";
import analysisRouter from "./routers/analysis.routes.js";
import plannerRouter from "./routers/planner.routes.js";
import intentRouter from "./routers/intent.routes.js";
import capbacRouter from "./routers/capbac.routes.js";
import automationRouter from "./routers/automation.routes.js";
import executionRouter from "./routers/execution.routes.js";
import stockAutoSessionRouter from "./routers/stockAutoSession.routes.js";

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
app.use("/api/planner", plannerRouter);
app.use("/api/intent", intentRouter);
app.use("/api/capbac", capbacRouter);
app.use("/api/automation", automationRouter);
app.use("/api/execution", executionRouter);
app.use("/api/stock-auto", stockAutoSessionRouter);

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

export default app;