/**
 * Runs a TypeScript entry under Node by bundling it with esbuild first.
 *
 * The app's own imports are extensionless, which is what the bundler expects
 * but not what Node's ESM resolver accepts, so the build scripts and the test
 * suite go through the same resolver the app does.
 *
 * Usage: node scripts/run-node.mjs scripts/selftest.ts
 */
import { build } from 'esbuild'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const entry = process.argv[2]
if (!entry) {
  console.error('usage: node scripts/run-node.mjs <entry.ts>')
  process.exit(2)
}

// Inside node_modules so Node resolves the externals from the project's own
// dependency tree rather than wherever the temp directory happens to live.
const dir = resolve('node_modules/.ukcd-run')
mkdirSync(dir, { recursive: true })
const out = join(dir, 'bundle.mjs')

try {
  await build({
    entryPoints: [resolve(entry)],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: out,
    // Keep real dependencies external so the bundle stays small and the code
    // under test runs against the same library versions the app ships.
    packages: 'external',
    logLevel: 'warning',
  })
  await import(pathToFileURL(out).href)
} finally {
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
}
