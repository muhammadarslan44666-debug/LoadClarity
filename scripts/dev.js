// Starts the API server and Vite website together on Windows, macOS, and Linux.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Resolve the CLI by its filesystem path. `require.resolve("vite/bin/vite.js")`
// fails with modern Vite releases because that subpath is not exported.
const viteBin = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [];
const run = (name, args) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
  children.push(child);
  child.on('error', (error) => {
    console.error(`${name} failed to start:`, error.message);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      if (code) console.error(`${name} stopped (code ${code ?? signal}).`);
      shutdown(code ?? 1);
    }
  });
  return child;
};

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = code;
}

run('Server', ['server/start.js']);
run('Website', [viteBin]);
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => shutdown(0));
}
