import { createRequire } from "module";
const require = createRequire(import.meta.url);
const config = require("./hardhat.config.cjs");
export default config;
