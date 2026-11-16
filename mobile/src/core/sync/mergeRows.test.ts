import type { BackupData } from "@/core/backup/backup.types";
import { mergeRows } from "@/core/sync/mergeRows";

type Srs = BackupData["srsStates"][number];

function srs(
  slug: string,
  reps: number,
  updatedAt = "2026-11-01T00:00:00.000Z",
): Srs {
  return {
    item: { itemType: "vocabulary", slug },
    stability: 2.5,
    difficulty: 5,
    dueDate: "2026-11-02T00:00:00.000Z",
    fsrsState: "review",
    reps,
    lapses: 0,
    learningSteps: 0,
    isBurned: false,
    srsStageLabel: "Apprentice 2",
    lastReviewedAt: null,
    updatedAt,
  };
}

const KEY = "vocabulary:neko";

describe("mergeRows", () => {
  it("local same, remote different → take_remote", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [srs("neko", 1)],
      [srs("neko", 2)],
    );
    expect(entry).toEqual({
      key: KEY,
      decision: "take_remote",
      base: srs("neko", 1),
      local: srs("neko", 1),
      remote: srs("neko", 2),
    });
  });

  it("local different, remote same → keep_local", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [srs("neko", 2)],
      [srs("neko", 1)],
    );
    expect(entry.decision).toBe("keep_local");
  });

  it("local same, remote same → unchanged", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [srs("neko", 1)],
      [srs("neko", 1)],
    );
    expect(entry.decision).toBe("unchanged");
  });

  it("both different and equal → same_change", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [srs("neko", 3)],
      [srs("neko", 3)],
    );
    expect(entry.decision).toBe("same_change");
  });

  it("both different and not equal → conflict", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [srs("neko", 2)],
      [srs("neko", 3)],
    );
    expect(entry.decision).toBe("conflict");
  });

  it("row in base, missing on remote, same on local → take_remote (delete)", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [srs("neko", 1)],
      [],
    );
    expect(entry.decision).toBe("take_remote");
    expect(entry.remote).toBeUndefined();
  });

  it("row in base, missing on local, same on remote → keep_local (delete)", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [],
      [srs("neko", 1)],
    );
    expect(entry.decision).toBe("keep_local");
    expect(entry.local).toBeUndefined();
  });

  it("row in base, deleted on local, changed on remote → conflict", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1)],
      [],
      [srs("neko", 2)],
    );
    expect(entry.decision).toBe("conflict");
    expect(entry.local).toBeUndefined();
  });

  it("row not in base, added on remote only → take_remote", () => {
    const [entry] = mergeRows("srsStates", [], [], [srs("neko", 1)]);
    expect(entry.decision).toBe("take_remote");
    expect(entry.base).toBeUndefined();
  });

  it("row not in base, added on both with equal content → same_change", () => {
    const [entry] = mergeRows(
      "srsStates",
      [],
      [srs("neko", 1)],
      [srs("neko", 1)],
    );
    expect(entry.decision).toBe("same_change");
  });

  it("no base: row on one side only → added (take_remote / keep_local)", () => {
    const [onRemote] = mergeRows("srsStates", null, [], [srs("neko", 1)]);
    expect(onRemote.decision).toBe("take_remote");
    const [onLocal] = mergeRows("srsStates", null, [srs("neko", 1)], []);
    expect(onLocal.decision).toBe("keep_local");
  });

  it("no base: row on both sides, different → conflict; no base: equal → same_change", () => {
    const [different] = mergeRows(
      "srsStates",
      null,
      [srs("neko", 1)],
      [srs("neko", 2)],
    );
    expect(different.decision).toBe("conflict");
    const [equal] = mergeRows(
      "srsStates",
      null,
      [srs("neko", 1)],
      [srs("neko", 1)],
    );
    expect(equal.decision).toBe("same_change");
  });

  it("updatedAt alone never makes a row different", () => {
    const [entry] = mergeRows(
      "srsStates",
      [srs("neko", 1, "2026-01-01T00:00:00.000Z")],
      [srs("neko", 1, "2026-02-01T00:00:00.000Z")],
      [srs("neko", 1, "2026-03-01T00:00:00.000Z")],
    );
    expect(entry.decision).toBe("unchanged");
  });

  it("returns one entry per key found on any side, sorted by key", () => {
    const entries = mergeRows(
      "srsStates",
      [srs("mizu", 1), srs("inu", 1)],
      [srs("neko", 1), srs("inu", 1)],
      [srs("mizu", 1), srs("inu", 1)],
    );
    expect(entries.map((entry) => entry.key)).toEqual([
      "vocabulary:inu",
      "vocabulary:mizu",
      "vocabulary:neko",
    ]);
    expect(entries.map((entry) => entry.decision)).toEqual([
      "unchanged",
      "keep_local",
      "keep_local",
    ]);
  });
});
