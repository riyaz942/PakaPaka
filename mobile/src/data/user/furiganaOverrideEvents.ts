type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Cross-mount sync for furigana overrides. Each `useFuriganaPreference` /
 * `useFuriganaOverrideList` instance keeps its own snapshot; writers notify
 * so retained tab screens reload from `user.db` without a remount.
 */
export function subscribeFuriganaOverrides(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyFuriganaOverridesChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}
