import chalk from "chalk";
import { start } from "./lib/index.js";

console.log(chalk.greenBright("[ Nexus ] is active ✅"));

start().catch(err => {
  console.error(chalk.red("❌ Bot failed to start:"));
  console.error(err && err.stack ? err.stack : err);
});