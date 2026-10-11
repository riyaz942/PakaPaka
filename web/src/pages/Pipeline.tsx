import { useState } from 'react';
import type { PipelineRunResult } from '../types/api';

type RunState = { status: 'idle' | 'running' | 'done'; result: PipelineRunResult | null };

function PipelinePanel({
  title,
  description,
  endpoint,
}: {
  title: string;
  description: string;
  endpoint: string;
}) {
  const [state, setState] = useState<RunState>({ status: 'idle', result: null });

  async function handleRun() {
    setState({ status: 'running', result: null });
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const result = (await res.json()) as PipelineRunResult;
      setState({ status: 'done', result });
    } catch (err) {
      setState({
        status: 'done',
        result: {
          ok: false,
          exitCode: null,
          stdout: '',
          stderr: err instanceof Error ? err.message : 'Request failed',
          durationMs: 0,
        },
      });
    }
  }

  const output = state.result ? `${state.result.stdout}${state.result.stderr}`.trim() : '';

  return (
    <section className="panel pipeline-panel">
      <div className="pipeline-panel__head">
        <div>
          <h3 className="panel-title">{title}</h3>
          <p className="panel-muted">{description}</p>
        </div>
        <div className="pipeline-panel__actions">
          {state.result ? (
            <span
              className={
                state.result.ok ? 'pipeline-status pipeline-status--pass' : 'pipeline-status pipeline-status--fail'
              }
            >
              {state.result.ok ? 'PASS' : 'FAIL'}
            </span>
          ) : null}
          <button
            type="button"
            className="audit-run-button"
            onClick={handleRun}
            disabled={state.status === 'running'}
          >
            {state.status === 'running' ? 'Running…' : `Run ${title}`}
          </button>
        </div>
      </div>
      {state.result ? (
        <>
          <p className="panel-muted">
            Exit code {state.result.exitCode ?? 'n/a'} · {(state.result.durationMs / 1000).toFixed(1)}s
          </p>
          <pre className="pipeline-log">{output || '(no output)'}</pre>
        </>
      ) : null}
    </section>
  );
}

export default function Pipeline() {
  return (
    <div className="pipeline-page">
      <h2 className="dashboard-title">Pipeline</h2>
      <p className="dashboard-sub">
        Runs the repo's own gates from this UI. Compile writes to a scratch database
        (<code>web/.build/curriculum.db</code>) — it never touches the mobile app's bundled seed.
      </p>
      <PipelinePanel
        title="validate-schema"
        description="npm run validate-schema — Ajv + furigana checks against curriculum/."
        endpoint="/api/pipeline/validate"
      />
      <PipelinePanel
        title="compile-curriculum"
        description="npm run compile-curriculum -- --update-registry — compiles curriculum/ into a scratch SQLite database and gives new items ids in curriculum/id-registry.json."
        endpoint="/api/pipeline/compile"
      />
    </div>
  );
}
