import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { JlptLevel } from './types.js';

export type FindingSeverity = 'ERROR' | 'WARNING' | 'INFO';

export type AuditFinding = {
  level: JlptLevel;
  check: string;
  severity: FindingSeverity;
  message: string;
  slugs: string[];
};

export type SeverityTotals = Record<FindingSeverity, number>;

export type AuditSummary = {
  lastRunAt: string | null;
  totals: SeverityTotals;
  byCheck: { check: string; totals: SeverityTotals }[];
};

const REPORT_LEVELS: { level: JlptLevel; fileSuffix: string }[] = [
  { level: 'N5', fileSuffix: 'n5' },
  { level: 'N4', fileSuffix: 'n4' },
];

function emptyTotals(): SeverityTotals {
  return { ERROR: 0, WARNING: 0, INFO: 0 };
}

function reportPath(root: string, fileSuffix: string, ext: 'json' | 'md'): string {
  return path.join(root, 'curriculum', '_build', 'reports', `content-audit-${fileSuffix}.${ext}`);
}

function readReport(root: string, level: JlptLevel, fileSuffix: string): AuditFinding[] {
  const filePath = reportPath(root, fileSuffix, 'json');
  if (!fs.existsSync(filePath)) return [];
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Array<{
    check: string;
    severity: FindingSeverity;
    message: string;
    slugs: string[];
  }>;
  return raw.map((f) => ({ ...f, level }));
}

let cache: AuditFinding[] | null = null;
let cachedRoot: string | null = null;

export function getAuditFindings(root: string): AuditFinding[] {
  if (cache && cachedRoot === root) return cache;
  cache = REPORT_LEVELS.flatMap(({ level, fileSuffix }) => readReport(root, level, fileSuffix));
  cachedRoot = root;
  return cache;
}

export function reloadAuditFindings(root: string): AuditFinding[] {
  cache = null;
  cachedRoot = null;
  return getAuditFindings(root);
}

/** Findings key by bare slug (radicals have no level prefix; kanji/vocab/grammar/passage do). */
export function buildAuditBySlug(findings: AuditFinding[]): Map<string, AuditFinding[]> {
  const map = new Map<string, AuditFinding[]>();
  for (const finding of findings) {
    for (const slug of finding.slugs) {
      const list = map.get(slug);
      if (list) list.push(finding);
      else map.set(slug, [finding]);
    }
  }
  return map;
}

function lastRunAt(root: string): string | null {
  let latest: number | null = null;
  for (const { fileSuffix } of REPORT_LEVELS) {
    const filePath = reportPath(root, fileSuffix, 'json');
    if (!fs.existsSync(filePath)) continue;
    const mtime = fs.statSync(filePath).mtimeMs;
    if (latest === null || mtime > latest) latest = mtime;
  }
  return latest === null ? null : new Date(latest).toISOString();
}

export function summarizeAudit(root: string): AuditSummary {
  const findings = getAuditFindings(root);
  const totals = emptyTotals();
  const byCheckMap = new Map<string, SeverityTotals>();

  for (const finding of findings) {
    totals[finding.severity] += 1;
    const bucket = byCheckMap.get(finding.check) ?? emptyTotals();
    bucket[finding.severity] += 1;
    byCheckMap.set(finding.check, bucket);
  }

  return {
    lastRunAt: lastRunAt(root),
    totals,
    byCheck: [...byCheckMap.entries()].map(([check, checkTotals]) => ({
      check,
      totals: checkTotals,
    })),
  };
}

export type RunAuditResult =
  | { ok: true; summary: AuditSummary }
  | { ok: false; error: string };

/**
 * Spawns the shipped-content audit against the repo's own Python venv.
 * Uses async `spawn` (not `spawnSync`) so a multi-minute run doesn't block
 * the server's single-threaded event loop for every other request.
 * audit_shipped.py exits 1 when it wrote at least one ERROR finding — that is
 * a completed run, not a failure of this tool.
 */
export function runAudit(root: string): Promise<RunAuditResult> {
  const buildDir = path.join(root, 'curriculum', '_build');
  const pythonBin = path.join(buildDir, '.venv', 'bin', 'python');
  if (!fs.existsSync(pythonBin)) {
    return Promise.resolve({
      ok: false,
      error: `Python venv not found at ${pythonBin} — run curriculum/_build's setup first`,
    });
  }

  return new Promise((resolve) => {
    const child = spawn(
      pythonBin,
      ['-m', 'generate_content.audit_shipped', '--json', '--level', 'n5', '--level', 'n4'],
      { cwd: buildDir },
    );

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: 'audit_shipped.py timed out after 10 minutes' });
    }, 10 * 60 * 1000);

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });

    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 && code !== 1) {
        resolve({
          ok: false,
          error: stderr.trim() || `audit_shipped.py exited with code ${code}`,
        });
        return;
      }
      reloadAuditFindings(root);
      resolve({ ok: true, summary: summarizeAudit(root) });
    });
  });
}
