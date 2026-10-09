import { decodeAbiParameters, parseAbiParameters, type Hex } from "viem";

/** Decode GIWA's Verified Address schema, whose content is exactly `bool isVerified`. */
export function decodeVerifiedAddressContent(data: Hex): boolean | undefined {
  if (!/^0x[0-9a-fA-F]{64}$/.test(data)) return undefined;
  try {
    return decodeAbiParameters(parseAbiParameters("bool"), data)[0];
  } catch {
    return undefined;
  }
}
