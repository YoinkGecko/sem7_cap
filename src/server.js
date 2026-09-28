import "./config/env.js";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});