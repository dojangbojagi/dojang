import type { Address, Hex } from "viem";
import { isAddress } from "viem";
import { appEnv } from "@/lib/config/env";

function checkedAddress(value?: string): Address | undefined {
  return value && isAddress(value) ? (value as Address) : undefined;
}

export const officialDojang = {
  dojangScroll: "0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9" as Address,
  dojangAttesterBook: "0xDA282E89244424E297Ce8e78089B54D043FB28B6" as Address,
  eas: "0x4200000000000000000000000000000000000021" as Address,
  upbitKoreaAttesterId:
    "0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034" as Hex,
  upbitKoreaAttester: "0x4097bF3Cb731AEB3E501b910B33B2aF9Fa68E38" as Address,
  verifiedAddressSchemaUid:
    "0x072d75e18b2be4f89a13a7147240477481c4b526d5795802acba59046b426e08" as Hex,
  testnetFaucetAttesterId:
    "0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678" as Hex,
  testnetFaucetAttester: "0x63CCe2b569A7bC35895ee24306c1512fefc06121" as Address,
};

export const projectContracts = {
  credentialRegistry: checkedAddress(appEnv.contracts.credentialRegistry),
  proofVerifier: checkedAddress(appEnv.contracts.proofVerifier),
  restrictedVault: checkedAddress(appEnv.contracts.restrictedVault),
  lendingPool: checkedAddress(appEnv.contracts.lendingPool),
} as const;

export const invalidContractConfig = Object.entries(appEnv.contracts)
  .filter(([, value]) => value && !isAddress(value))
  .map(([key]) => key);
