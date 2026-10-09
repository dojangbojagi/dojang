import assert from "node:assert/strict";
import { createPublicClient, http, zeroAddress, zeroHash } from "viem";
import { easAbi, dojangScrollAbi } from "../src/lib/contracts/abis";
import { officialDojang } from "../src/lib/config/contracts";
import { giwaSepolia, GIWA_CHAIN_ID } from "../src/lib/config/chain";

const rpcUrl = "https://sepolia-rpc.giwa.io";
const client = createPublicClient({ chain: giwaSepolia, transport: http(rpcUrl, { timeout: 15_000 }) });
const uncredentialedTestAddress = "0x000000000000000000000000000000000000dEaD" as const;

const chainId = await client.getChainId();
assert.equal(chainId, GIWA_CHAIN_ID, `Unexpected chain id from ${rpcUrl}`);

const [verified, uid] = await Promise.all([
  client.readContract({
    address: officialDojang.dojangScroll,
    abi: dojangScrollAbi,
    functionName: "isVerified",
    args: [uncredentialedTestAddress, officialDojang.upbitKoreaAttesterId],
  }),
  client.readContract({
    address: officialDojang.dojangScroll,
    abi: dojangScrollAbi,
    functionName: "getVerifiedAddressAttestationUid",
    args: [uncredentialedTestAddress, officialDojang.upbitKoreaAttesterId],
  }),
]);

assert.equal(verified, false, "The synthetic uncredentialed address unexpectedly returned verified");
assert.equal(uid, zeroHash, "The synthetic uncredentialed address unexpectedly returned an attestation UID");

const [emptyValidity, emptyAttestation] = await Promise.all([
  client.readContract({
    address: officialDojang.eas,
    abi: easAbi,
    functionName: "isAttestationValid",
    args: [zeroHash],
  }),
  client.readContract({
    address: officialDojang.eas,
    abi: easAbi,
    functionName: "getAttestation",
    args: [zeroHash],
  }),
]);

assert.equal(emptyValidity, false, "EAS reported the zero UID as valid");
assert.equal(emptyAttestation.uid, zeroHash, "EAS returned a non-empty zero-UID attestation");

process.stdout.write(`${JSON.stringify({
  rpcUrl,
  chainId,
  checkedAddress: uncredentialedTestAddress,
  dojangScrollAddress: officialDojang.dojangScroll,
  easAddress: officialDojang.eas,
  verified,
  attestationUid: uid,
  zeroUidValid: emptyValidity,
  zeroUidAttestationEmpty: emptyAttestation.uid === zeroHash,
  result: "live DojangScroll discovery/status and EAS validity/tuple reads passed for an uncredentialed test address",
  scope: "No credentialed wallet was supplied; this run does not claim a live positive attestation read.",
}, null, 2)}\n`);
