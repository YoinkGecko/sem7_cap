const express = require("express");
const runCommand = require("./config/command");
const accountRouter = require("./routes/account.router");

const app = express();
const PORT = 3000;

app.get("/ls", (req, res) => {
  runCommand("ls -la", res);
});

app.get("/pwd", (req, res) => {
  runCommand("pwd", res);
});

app.use("/account", accountRouter);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
