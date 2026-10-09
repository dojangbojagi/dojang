"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { DemoCredentialWitness } from "@/lib/credential/witness";
import type { EligibilityProof } from "@/lib/protocol/types";

interface WitnessContextValue {
  witness: DemoCredentialWitness | null;
  setWitness: (witness: DemoCredentialWitness | null) => void;
  proof: EligibilityProof | null;
  setProof: (proof: EligibilityProof | null) => void;
}

const WitnessContext = createContext<WitnessContextValue | null>(null);

export function DemoWitnessProvider({ children }: { children: ReactNode }) {
  const [witness, setWitnessState] = useState<DemoCredentialWitness | null>(null);
  const [proof, setProof] = useState<EligibilityProof | null>(null);
  const setWitness = useCallback((nextWitness: DemoCredentialWitness | null) => {
    setWitnessState(nextWitness);
    setProof(null);
  }, []);
  const value = useMemo(() => ({ witness, setWitness, proof, setProof }), [proof, setWitness, witness]);
  return <WitnessContext.Provider value={value}>{children}</WitnessContext.Provider>;
}

export function useDemoWitness() {
  const value = useContext(WitnessContext);
  if (!value) throw new Error("useDemoWitness must be used inside DemoWitnessProvider");
  return value;
}
