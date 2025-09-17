import chalk from "chalk";

let start;
try {
  ({ start } = await import("./lib/index.js"));
  await start();
  console.log(chalk.greenBright("[ Nexus ] is active ✅"));
} catch (err) {
  console.error(chalk.red("❌ Bot failed to start:"));
  console.error(err && err.stack ? err.stack : err);
}