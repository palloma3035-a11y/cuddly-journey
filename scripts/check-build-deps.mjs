#!/usr/bin/env node
/**
 * Build health check: verifies required npm packages are resolvable
 * before running `vite build`. Fails fast with a clear, actionable message
 * instead of a cryptic Vite "Cannot find package" error.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Packages that vite.config.ts (and its plugins) import at build time.
// Add to this list whenever a new build-time dep is introduced.
const REQUIRED = [
  "@tailwindcss/vite",
  "tailwindcss",
  "@vitejs/plugin-react",
  "@tanstack/router-plugin",
  "vite",
];

const missing = [];
for (const pkg of REQUIRED) {
  try {
    require.resolve(pkg);
  } catch {
    missing.push(pkg);
  }
}

if (missing.length > 0) {
  console.error("\n\u274c  Build health check failed.");
  console.error("Missing required packages:\n");
  for (const pkg of missing) console.error(`  - ${pkg}`);
  console.error(`\nFix: bun add -d ${missing.join(" ")}\n`);
  process.exit(1);
}

console.log(`\u2705  Build health check passed (${REQUIRED.length} packages OK).`);
