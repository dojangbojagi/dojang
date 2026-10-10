"use client";

import { useReadContract } from "wagmi";
import { shortAddress } from "@/components/lending/format";
import { GIWA_CHAIN_ID, GIWA_EXPLORER_URL } from "@/lib/config/chain";
import { projectContracts } from "@/lib/config/contracts";
import { controlledTokenAbi, lendingPoolAbi } from "@/lib/contracts/abis";
import type { Address } from "viem";

function useAsset(functionName: "lendingAsset" | "collateralAsset") {
  const pool = projectContracts.lendingPool;
  const address = useReadContract({
    address: pool,
    chainId: GIWA_CHAIN_ID,
    abi: lendingPoolAbi,
    functionName,
    query: { enabled: Boolean(pool), retry: 1 },
  });
  const symbol = useReadContract({
    address: address.data as Address | undefined,
    chainId: GIWA_CHAIN_ID,
    abi: controlledTokenAbi,
    functionName: "symbol",
    query: { enabled: Boolean(address.data), retry: 1 },
  });
  return { address: address.data as Address | undefined, symbol: symbol.data, failed: address.isError, loading: Boolean(pool) && address.isPending };
}

function AssetRow({ name, role, asset }: { name: string; role: string; asset: ReturnType<typeof useAsset> }) {
  return (
    <div className="contract-row">
      <dt>
        <strong>{name}{asset.symbol ? ` · ${asset.symbol}` : ""}</strong>
        <span className="xsmall muted">{role}</span>
      </dt>
      <dd>
        {asset.address ? (
          <>
            <span className="status" data-state="valid"><i className="status__dot" aria-hidden="true" />Read from the LendingPool</span>
            <a href={`${GIWA_EXPLORER_URL}/address/${asset.address}`} target="_blank" rel="noopener noreferrer"><code>{asset.address}</code><span className="visually-hidden"> ({shortAddress(asset.address)}, opens in a new tab)</span></a>
          </>
        ) : (
          <>
            <span className="status" data-state={asset.failed ? "invalid" : "warn"}><i className="status__dot" aria-hidden="true" />{asset.failed ? "Read failed" : asset.loading ? "Reading…" : "Not available"}</span>
            <span className="xsmall muted">{projectContracts.lendingPool ? "Read from the configured LendingPool." : "Known only after a LendingPool is configured; no address is assumed."}</span>
          </>
        )}
      </dd>
    </div>
  );
}

/** The two demo tokens are not configured separately: the pool itself says which tokens it uses. */
export function LendingAssetRows() {
  const lending = useAsset("lendingAsset");
  const collateral = useAsset("collateralAsset");
  return (
    <>
      <AssetRow name="Lending asset (ControlledTestToken)" role="Capped, role-minted demo token that suppliers lend and borrowers receive" asset={lending} />
      <AssetRow name="Collateral asset (ControlledTestToken)" role="Capped, role-minted demo token that borrowers lock as collateral" asset={collateral} />
    </>
  );
}
