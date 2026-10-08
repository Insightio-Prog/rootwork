export type LayoutCheckState = {
  offsetsOnMount: number | null;
  stabilizeRan: boolean;
  endpointMismatches: string[];
};

let state: LayoutCheckState = {
  offsetsOnMount: null,
  stabilizeRan: false,
  endpointMismatches: [],
};

const listeners = new Set<() => void>();

export function getLayoutCheck(): LayoutCheckState {
  return state;
}

export function setLayoutCheck(next: Partial<LayoutCheckState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeLayoutCheck(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
