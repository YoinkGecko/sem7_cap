import express from "express";

import accountRouter from "./routers/account.routes.js";
import ordersRouter from "./routers/orders.routes.js";
import optionsRouter from "./routers/options.routes.js";
import marketRouter from "./routers/market.routes.js";
import watchlistRouter from "./routers/watchlist.routes.js";
import assetsRouter from "./routers/assets.routes.js";

const app = express();

app.use(express.json());

app.use("/api/account", accountRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/options", optionsRouter);
app.use("/api/market", marketRouter);
app.use("/api/watchlists", watchlistRouter);
app.use("/api/assets", assetsRouter);

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

export default app;