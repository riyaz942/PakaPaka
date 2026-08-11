import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { SeverityBadge } from '../components/SeverityBadge';
import { useApi } from '../hooks/useApi';
import {
  AUDIT_COMMANDS,
  AUDIT_FIXES,
  GUIDE_BUILD_NOTE,
  GUIDE_STAGES,
  contentGapHref,
  getStage,
  withLevel,
  type GuideLane,
  type GuideStage,
  type ProducedField,
} from '../lib/guide';
import {
  CONTENT_TYPE_LABELS,
  type AuditSummary,
  type GapsResponse,
  type JlptLevel,
} from '../types/api';

const LEVELS: JlptLevel[] = ['N5', 'N4'];

function isLevel(value: string | null): value is JlptLevel {
  return value === 'N5' || value === 'N4';
}

/** Missing count for one produced field, or null while gaps are loading. */
function gapFor(
  gaps: GapsResponse | null,
  field: ProducedField,
  level: JlptLevel,
): { missing: number; total: number } | null {
  if (!gaps) return null;
  const bucket = gaps.byTypeLevel[field.type]?.[level];
  if (!bucket) return null;
  return { missing: bucket.missing[field.field] ?? 0, total: bucket.total };
}

/**
 * The stage's headline number: the largest single-field gap across the fields
 * it actually owes. Summing fields would double-count items missing several,
 * and optional fields are excluded entirely — a radical with no `description`
 * is finished, not outstanding.
 */
function stageGapTotal(
  stage: GuideStage,
  gaps: GapsResponse | null,
  level: JlptLevel,
): number | null {
  const owed = stage.produces.filter((f) => !f.optional);
  if (!gaps || owed.length === 0) return null;
  let worst = 0;
  for (const field of owed) {
    const gap = gapFor(gaps, field, level);
    if (gap) worst = Math.max(worst, gap.missing);
  }
  return worst;
}

/** Renders `backtick` spans as inline code, and fills in the level token. */
function Prose({ text, level }: { text: string; level?: JlptLevel }) {
  const resolved = level ? withLevel(text, level) : text;
  const parts = resolved.split('`');
  // Odd backtick count means an unclosed span — render it verbatim rather than
  // silently code-formatting the rest of the sentence.
  if (parts.length % 2 === 0) return <>{resolved}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <code key={i}>{part}</code> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={copied ? 'copy-button copy-button--done' : 'copy-button'}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => setCopied(false),
        );
      }}
      aria-label={`Copy: ${text}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CommandBlock({ commands, level }: { commands: string[]; level: JlptLevel }) {
  const resolved = commands.map((c) => withLevel(c, level));
  return (
    <div className="guide-commands">
      {resolved.map((command) => (
        <div key={command} className="guide-command">
          <code>{command}</code>
          <CopyButton text={command} />
        </div>
      ))}
    </div>
  );
}

function LaneBody({ lane, level }: { lane: GuideLane; level: JlptLevel }) {
  return (
    <div className="guide-lane">
      <p className="panel-muted">
        <Prose text={lane.summary} level={level} />
      </p>
      <ol className="guide-steps">
        {lane.steps.map((step) => (
          <li key={step.title} className="guide-step">
            <div className="guide-step__title">{step.title}</div>
            {step.detail ? (
              <p className="guide-step__detail">
                <Prose text={step.detail} level={level} />
              </p>
            ) : null}
            {step.commands ? <CommandBlock commands={step.commands} level={level} /> : null}
          </li>
        ))}
      </ol>
      {lane.runbook ? (
        <p className="panel-muted guide-runbook">
          Full runbook: <code>{lane.runbook}</code>
        </p>
      ) : null}
    </div>
  );
}

function GapRow({
  field,
  level,
  gaps,
}: {
  field: ProducedField;
  level: JlptLevel;
  gaps: GapsResponse | null;
}) {
  const gap = gapFor(gaps, field, level);
  const done = gap ? gap.total - gap.missing : 0;
  const percent = gap && gap.total > 0 ? Math.round((done / gap.total) * 100) : 0;
  const tone = !gap || field.optional
    ? 'guide-gap--idle'
    : gap.missing === 0
      ? 'guide-gap--done'
      : percent >= 60
        ? 'guide-gap--mid'
        : 'guide-gap--low';

  return (
    <li className={`guide-gap ${tone}`}>
      <div className="guide-gap__head">
        <span className="guide-gap__field">
          <span className="guide-gap__type">{CONTENT_TYPE_LABELS[field.type]}</span>
          <code>{field.field}</code>
          {field.optional ? (
            <span className="guide-gap__optional">optional</span>
          ) : null}
        </span>
        {gap ? (
          gap.missing === 0 ? (
            <span className="guide-gap__count guide-gap__count--done">
              all {gap.total} done
            </span>
          ) : (
            <Link
              to={contentGapHref(field.type, field.field, level)}
              className="guide-gap__count"
              title={`Open the ${level} ${CONTENT_TYPE_LABELS[field.type]} still missing ${field.field}`}
            >
              {gap.missing} of {gap.total} missing →
            </Link>
          )
        ) : (
          <span className="guide-gap__count guide-gap__count--idle">…</span>
        )}
      </div>
      <div
        className="guide-gap__track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${CONTENT_TYPE_LABELS[field.type]} ${field.field} filled`}
      >
        <div className="guide-gap__fill" style={{ width: `${percent}%` }} />
      </div>
      {field.note ? (
        <p className="guide-gap__note">
          <Prose text={field.note} />
        </p>
      ) : null}
    </li>
  );
}

function StageCard({
  stage,
  index,
  level,
  gaps,
  open,
  onToggle,
}: {
  stage: GuideStage;
  index: number;
  level: JlptLevel;
  gaps: GapsResponse | null;
  open: boolean;
  onToggle: () => void;
}) {
  const [params] = useSearchParams();
  const search = params.toString();
  const [laneId, setLaneId] = useState(stage.lanes[0]?.id ?? '');
  const lane = stage.lanes.find((l) => l.id === laneId) ?? stage.lanes[0];
  const worst = stageGapTotal(stage, gaps, level);

  const blockers = stage.requires
    .map((id) => {
      const required = getStage(id);
      if (!required) return null;
      const gap = stageGapTotal(required, gaps, level);
      return { stage: required, gap };
    })
    .filter((b): b is { stage: GuideStage; gap: number | null } => b !== null);

  return (
    <section className="panel guide-stage" id={`stage-${stage.id}`}>
      <header className="guide-stage__head">
        <button
          type="button"
          className="guide-stage__toggle"
          onClick={onToggle}
          aria-expanded={open}
        >
          <span className="guide-stage__index">{index}</span>
          <span className="guide-stage__title">{stage.title}</span>
          <span className="guide-stage__chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
        </button>
        {worst === null ? null : worst === 0 ? (
          <span className="guide-badge guide-badge--done">complete for {level}</span>
        ) : (
          <span className="guide-badge guide-badge--open">
            {worst} {level} item{worst === 1 ? '' : 's'} to go
          </span>
        )}
      </header>

      <p className="guide-stage__what">
        <Prose text={stage.what} level={level} />
      </p>

      {open ? (
        <>
          {blockers.length > 0 ? (
            <div className="guide-requires">
              <span className="guide-requires__label">Do first:</span>
              {blockers.map(({ stage: required, gap }) => (
                <Link
                  key={required.id}
                  to={{ search, hash: `#stage-${required.id}` }}
                  className={
                    gap && gap > 0
                      ? 'guide-requires__chip guide-requires__chip--blocked'
                      : 'guide-requires__chip'
                  }
                  title={
                    gap && gap > 0
                      ? `${gap} ${level} items still missing content from ${required.title}`
                      : `${required.title} has no gaps at ${level}`
                  }
                >
                  {required.title}
                  {gap === null ? null : gap > 0 ? ` · ${gap} left` : ' ✓'}
                </Link>
              ))}
            </div>
          ) : null}

          {stage.requiresNote ? (
            <p className="guide-note">
              <Prose text={stage.requiresNote} level={level} />
            </p>
          ) : null}

          {stage.produces.length > 0 ? (
            <ul className="guide-gaps">
              {stage.produces.map((field) => (
                <GapRow
                  key={`${field.type}:${field.field}`}
                  field={field}
                  level={level}
                  gaps={gaps}
                />
              ))}
            </ul>
          ) : null}

          {stage.lanes.length > 1 ? (
            <div className="guide-lane-tabs" role="tablist" aria-label={`${stage.title} lane`}>
              {stage.lanes.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={l.id === lane?.id}
                  className={l.id === lane?.id ? 'tab tab--active' : 'tab'}
                  onClick={() => setLaneId(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          ) : null}

          {lane ? <LaneBody lane={lane} level={level} /> : null}

          {stage.finish ? (
            <div className="guide-finish">
              <h4 className="guide-finish__title">After a batch</h4>
              {stage.finishNote ? (
                <p className="guide-step__detail">
                  <Prose text={stage.finishNote} level={level} />
                </p>
              ) : null}
              <CommandBlock commands={stage.finish} level={level} />
              <p className="panel-muted">
                Then read what you generated and set its status —{' '}
                <Link to={{ search, hash: '#stage-review' }}>human review</Link> is the last gate, and{' '}
                <code>compile-curriculum</code> warns on anything still draft.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function Guide() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const levelParam = searchParams.get('level');
  const level: JlptLevel = isLevel(levelParam) ? levelParam : 'N5';

  const gapsResult = useApi<GapsResponse>('/api/gaps');
  const auditResult = useApi<AuditSummary>('/api/audit/summary');
  const gaps = gapsResult.status === 'ok' ? gapsResult.data : null;

  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});
  const [autoOpened, setAutoOpened] = useState(false);

  // Open every stage that still has a gap at the selected level, once the
  // counts land — the page is a worklist first and a reference second.
  useEffect(() => {
    if (!gaps || autoOpened) return;
    setAutoOpened(true);
    const next: Record<string, boolean> = {};
    for (const stage of GUIDE_STAGES) {
      const worst = stageGapTotal(stage, gaps, level);
      next[stage.id] = worst === null ? false : worst > 0;
    }
    setOpenStages(next);
  }, [gaps, level, autoOpened]);

  // React Router doesn't scroll to a hash on navigation, and a stage arrived
  // at by deep link has to be open before it can be scrolled to. Waiting for
  // `autoOpened` matters: auto-collapsing the finished stages changes the page
  // height, so a scroll taken before that lands in the wrong place.
  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (!hash) return;
    const stageId = hash.startsWith('stage-') ? hash.slice('stage-'.length) : null;
    if (stageId) {
      setOpenStages((prev) => (prev[stageId] ? prev : { ...prev, [stageId]: true }));
    }
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ block: 'start' });
      el.classList.add('guide-target');
      setTimeout(() => el.classList.remove('guide-target'), 2000);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.key, autoOpened]);

  const setLevel = useCallback(
    (next: JlptLevel) => {
      const params = new URLSearchParams(searchParams);
      params.set('level', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const findingsByCheck = useMemo(() => {
    const map = new Map<string, { ERROR: number; WARNING: number; INFO: number }>();
    if (auditResult.status !== 'ok') return map;
    for (const row of auditResult.data.byCheck) {
      map.set(row.check, row.totals);
    }
    return map;
  }, [auditResult]);

  const openStageCount = GUIDE_STAGES.filter(
    (stage) => (stageGapTotal(stage, gaps, level) ?? 0) > 0,
  ).length;

  return (
    <div className="guide-page">
      <section className="panel guide-hero">
        <div>
          <h2 className="dashboard-title">How content gets made</h2>
          <p className="dashboard-sub">
            Every content type is generated by the same loop: build a prompt from the
            curriculum, get a reply from a model, and push it back through a mechanical gate
            that either merges it or tells the model exactly what it broke. Nothing here needs
            API credentials.
          </p>
          <p className="panel-muted">
            {GUIDE_BUILD_NOTE.split('`').map((part, i) =>
              i % 2 === 1 ? <code key={i}>{part}</code> : part,
            )}{' '}
            Commands below are filled in for the level you pick.
          </p>
        </div>
        <div className="guide-hero__controls">
          <div className="chip-group" role="group" aria-label="Level">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={level === lvl ? 'chip chip--active' : 'chip'}
                onClick={() => setLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
          <p className="panel-muted guide-hero__status">
            {gapsResult.status === 'loading'
              ? 'Loading current gaps…'
              : gapsResult.status === 'error'
                ? 'Gap counts unavailable'
                : `${openStageCount} stage${openStageCount === 1 ? '' : 's'} with ${level} gaps`}
          </p>
        </div>
      </section>

      <section className="panel guide-flow">
        <h3 className="panel-title">Order of work</h3>
        <p className="panel-muted">
          Each stage reads the prose the one before it produced. Jump to any of them; the
          count is what is still missing at {level}.
        </p>
        <ol className="guide-flow__list">
          {GUIDE_STAGES.map((stage, i) => {
            const worst = stageGapTotal(stage, gaps, level);
            return (
              <li key={stage.id} className="guide-flow__item">
                <Link
                  to={{ search: searchParams.toString(), hash: `#stage-${stage.id}` }}
                  className={
                    worst && worst > 0
                      ? 'guide-flow__node guide-flow__node--open'
                      : worst === 0
                        ? 'guide-flow__node guide-flow__node--done'
                        : 'guide-flow__node'
                  }
                >
                  <span className="guide-flow__index">{i + 1}</span>
                  <span className="guide-flow__label">{stage.title}</span>
                  {worst === null ? null : (
                    <span className="guide-flow__count">
                      {worst === 0 ? '✓' : worst}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {GUIDE_STAGES.map((stage, i) => (
        <StageCard
          key={stage.id}
          stage={stage}
          index={i + 1}
          level={level}
          gaps={gaps}
          open={openStages[stage.id] ?? false}
          onToggle={() =>
            setOpenStages((prev) => ({ ...prev, [stage.id]: !(prev[stage.id] ?? false) }))
          }
        />
      ))}

      <section className="panel guide-audit" id="audit-flow">
        <h3 className="panel-title">Running the gates</h3>
        <p className="panel-muted">
          The audit re-runs every draft-stage gate against what actually shipped, plus the
          deterministic corpus checks. Findings on the Content and item pages come from the
          last report written to disk — re-run it after editing content, or they go stale.
        </p>
        {AUDIT_COMMANDS.map((entry) => (
          <div key={entry.title} className="guide-step">
            <div className="guide-step__title">{entry.title}</div>
            <p className="guide-step__detail">
              <Prose text={entry.detail} level={level} />
            </p>
            <CommandBlock commands={entry.commands} level={level} />
          </div>
        ))}
        <p className="panel-muted">
          <Link to="/audit">Audit tab</Link> runs the deterministic pass for both levels from
          the UI; <Link to="/pipeline">Pipeline tab</Link> runs validate and compile.
        </p>
      </section>

      <section className="panel guide-fixes" id="audit-fixes">
        <h3 className="panel-title">Fixing audit findings</h3>
        <p className="panel-muted">
          One card per check the audit reports. Counts are from the last run.
        </p>
        <div className="guide-fix-list">
          {AUDIT_FIXES.map((fix) => {
            const totals = fix.checks
              .map((check) => findingsByCheck.get(check))
              .filter((t): t is { ERROR: number; WARNING: number; INFO: number } => !!t)
              .reduce(
                (acc, t) => ({
                  ERROR: acc.ERROR + t.ERROR,
                  WARNING: acc.WARNING + t.WARNING,
                  INFO: acc.INFO + t.INFO,
                }),
                { ERROR: 0, WARNING: 0, INFO: 0 },
              );
            const hasAny = totals.ERROR + totals.WARNING + totals.INFO > 0;

            return (
              <article key={fix.id} className="guide-fix" id={fix.id}>
                <header className="guide-fix__head">
                  <h4 className="guide-fix__title">{fix.title}</h4>
                  <div className="guide-fix__totals">
                    {totals.ERROR > 0 ? (
                      <SeverityBadge severity="ERROR" count={totals.ERROR} />
                    ) : null}
                    {totals.WARNING > 0 ? (
                      <SeverityBadge severity="WARNING" count={totals.WARNING} />
                    ) : null}
                    {totals.INFO > 0 ? (
                      <SeverityBadge severity="INFO" count={totals.INFO} />
                    ) : null}
                    {auditResult.status === 'ok' && !hasAny ? (
                      <span className="guide-badge guide-badge--done">clean</span>
                    ) : null}
                  </div>
                </header>
                <p className="guide-fix__severity">{fix.severityNote}</p>
                <p className="guide-step__detail">
                  <Prose text={fix.what} level={level} />
                </p>
                <ul className="guide-fix__steps">
                  {fix.fix.map((line) => (
                    <li key={line}>
                      <Prose text={line} level={level} />
                    </li>
                  ))}
                </ul>
                {fix.commands ? <CommandBlock commands={fix.commands} level={level} /> : null}
                {hasAny ? (
                  <Link
                    to={`/audit?check=${encodeURIComponent(fix.checks[0])}`}
                    className="guide-fix__link"
                  >
                    Show these findings →
                  </Link>
                ) : null}
                <p className="panel-muted guide-fix__check">
                  Audit check: {fix.checks.map((c) => <code key={c}>{c}</code>)}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
