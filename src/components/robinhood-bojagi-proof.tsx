"use client";

import { useEffect, useState } from "react";
import { EligibilityCard } from "@/components/lending-v2/v2-eligibility";
import { WalletNetworkCard } from "@/components/wallet-network-card";
import { useLendingMarketV2 } from "@/hooks/use-lending-market-v2";
import { useLendingV2EligibilityProof } from "@/hooks/use-lending-v2-eligibility-proof";
import { useWalletNetwork } from "@/hooks/use-wallet-network";
import { ROBINHOOD_TESTNET_CHAIN_ID } from "@/lib/config/robinhood-testnet";
import type { DemoCredentialWitness } from "@/lib/credential/witness";

export function RobinhoodBojagiProof() {
  const wallet = useWalletNetwork(ROBINHOOD_TESTNET_CHAIN_ID);
  const market = useLendingMarketV2();
  const [witness, setWitness] = useState<DemoCredentialWitness | null>(null);
  const proof = useLendingV2EligibilityProof(witness ?? undefined);

  useEffect(() => {
    if (witness && wallet.address?.toLowerCase() !== witness.wallet.toLowerCase()) setWitness(null);
  }, [wallet.address, witness]);

  return (
    <div className="protocol-stack">
      <WalletNetworkCard expectedChainId={ROBINHOOD_TESTNET_CHAIN_ID} />
      <EligibilityCard market={market} proof={proof} witness={witness} onWitness={setWitness} />
    </div>
  );
}
