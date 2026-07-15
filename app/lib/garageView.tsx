"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useClpr, useHydrated, type State } from "./store";

// When present, this overrides the live store for the garage subtree — used to
// render another user's garage from a fetched, read-only state. Absent on your own
// garage (and everywhere else), where components read the live singleton store.
type GarageView = { state: State; hydrated: boolean; readOnly: boolean };

const GarageViewContext = createContext<GarageView | null>(null);

export function GarageViewProvider({ value, children }: { value: GarageView; children: ReactNode }) {
  return <GarageViewContext.Provider value={value}>{children}</GarageViewContext.Provider>;
}

// The state a garage component should render. Returns an overriding view (another
// user's garage) if one is provided, otherwise the signed-in user's live store.
export function useGarageState(): { s: State; hydrated: boolean; readOnly: boolean } {
  const view = useContext(GarageViewContext);
  const liveState = useClpr();
  const liveHydrated = useHydrated();
  if (view) return { s: view.state, hydrated: view.hydrated, readOnly: view.readOnly };
  return { s: liveState, hydrated: liveHydrated, readOnly: false };
}
