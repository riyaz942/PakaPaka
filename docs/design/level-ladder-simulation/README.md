# Level ladder simulation page

A one-page HTML view of the 60-level ladder, as the plan simulated it on 22 Nov 2026 (spec §7.2 rules applied to the old per-JLPT files). It is a planning snapshot. It is not the built ladder.

- `level-ladder.html` is the page. It is self-contained. Open it with `open level-ladder.html`.
  - Solid pink: work to do before release.
  - Dashed blue: work for the later phase.
- `sim.py` is the script that made it. It was rebuilt from the session transcript.

The built ladder is in `curriculum/_build/ladder.json`. Its text view is `curriculum/_build/reports/ladder-report.md`.

## Make the page again

`sim.py` reads the old per-JLPT files (`kanji/n5.json` and so on). These no longer exist on this branch. Use the curriculum as it was at commit `c7787e00`:

```bash
mkdir -p /tmp/ladder-old
git archive c7787e00 curriculum | tar -x -C /tmp/ladder-old
mkdir -p /tmp/ladder-old/curriculum/_build/data
cp curriculum/_build/data/ref_subjects.json /tmp/ladder-old/curriculum/_build/data/   # gitignored
python3 -I docs/design/level-ladder-simulation/sim.py /tmp/ladder-old/curriculum out.html
```

## The current page

`level-ladder-current.html` shows the built ladder, not the simulation. `curriculum/_build/reports/ladder_page.py` makes it from `ladder.json`, the item files and `ladder-worklist.json`:

```bash
python3 curriculum/_build/reports/ladder_page.py
```

The pink and blue marks are as new as the worklist. For fresh marks, run `ladder_report.py` first (a few minutes).
