"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RobinhoodAppChainId } from "@/components/protocol-network-selection";
import { appEnv } from "@/lib/config/env";

const allNetworks = [
  { id: 4_663, full: "Robinhood Mainnet — 4663", compact: "Mainnet 4663" },
  { id: 46_630, full: "Robinhood Testnet — 46630", compact: "Testnet 46630" },
] as const;
const networks = appEnv.mainnetVisible ? allNetworks : allNetworks.filter((network) => network.id === 46_630);

export function ProtocolNetworkPicker({
  selectedChainId,
  onSelect,
}: {
  selectedChainId: RobinhoodAppChainId;
  onSelect: (chainId: RobinhoodAppChainId) => void;
}) {
  const selected = networks.find((network) => network.id === selectedChainId) ?? networks[0];

  return (
    <div className="protocol-network-picker">
      <span className="protocol-network-picker__label">App network</span>
      <Select
        value={String(selected.id)}
        onValueChange={(value) => {
          const chainId = Number(value);
          if (networks.some((network) => network.id === chainId)) onSelect(chainId as RobinhoodAppChainId);
        }}
      >
        <SelectTrigger className="gyevo-select__trigger" aria-label="Select application network">
          <SelectValue aria-label={selected.full}>
            <span className="protocol-network-picker__full">{selected.full}</span>
            <span className="protocol-network-picker__compact">{selected.compact}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="gyevo-select__content" align="end">
          {networks.map((network) => (
            <SelectItem className="gyevo-select__item" key={network.id} value={String(network.id)}>
              {network.full}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
