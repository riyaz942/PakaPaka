import { spawn } from 'node:child_process';
import path from 'node:path';

export type PipelineRunResult = {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

const TIMEOUT_MS = 5 * 60 * 1000;

function runNpmScript(
  repoRoot: string,
  script: string,
  env?: NodeJS.ProcessEnv,
  args: string[] = [],
): Promise<PipelineRunResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const child = spawn('npm', ['run', script, ...args], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
    }, TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr: stderr || err.message,
        durationMs: Date.now() - start,
      });
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, exitCode: code, stdout, stderr, durationMs: Date.now() - start });
    });
  });
}

export function runValidate(repoRoot: string): Promise<PipelineRunResult> {
  return runNpmScript(repoRoot, 'validate-schema');
}

/**
 * Writes to a web/.build scratch path — never the mobile app's bundled seed.
 * Passes `--update-registry` so an item added in the studio gets an id in
 * `curriculum/id-registry.json`; the terminal compile stays strict by default.
 */
export function runCompile(repoRoot: string, webRoot: string): Promise<PipelineRunResult> {
  const outputPath = path.join(webRoot, '.build', 'curriculum.db');
  return runNpmScript(repoRoot, 'compile-curriculum', { COMPILE_OUTPUT_PATH: outputPath }, [
    '--',
    '--update-registry',
  ]);
}
