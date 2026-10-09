import assert from "node:assert/strict";
import { createPublicClient, encodeAbiParameters, http, parseAbiParameters, zeroHash } from "viem";
import { dojangAttesterBookAbi, easAbi, dojangScrollAbi } from "../src/lib/contracts/abis";
import { officialDojang } from "../src/lib/config/contracts";
import { giwaSepolia, GIWA_CHAIN_ID } from "../src/lib/config/chain";
import { decodeVerifiedAddressContent } from "../src/lib/protocol/dojang-content";

const rpcUrl = "https://sepolia-rpc.giwa.io";
const client = createPublicClient({ chain: giwaSepolia, transport: http(rpcUrl, { timeout: 15_000 }) });
const uncredentialedTestAddress = "0x000000000000000000000000000000000000dEaD" as const;
const trueContent = encodeAbiParameters(parseAbiParameters("bool"), [true]);
const falseContent = encodeAbiParameters(parseAbiParameters("bool"), [false]);
assert.equal(decodeVerifiedAddressContent(trueContent), true, "Verified Address true content did not decode");
assert.equal(decodeVerifiedAddressContent(falseContent), false, "Verified Address false content did not decode");
assert.equal(decodeVerifiedAddressContent("0x"), undefined, "Malformed Verified Address content was accepted");

const chainId = await client.getChainId();
assert.equal(chainId, GIWA_CHAIN_ID, `Unexpected chain id from ${rpcUrl}`);

const attesterFromBook = await client.readContract({
  address: officialDojang.dojangAttesterBook,
  abi: dojangAttesterBookAbi,
  functionName: "getAttester",
  args: [officialDojang.upbitKoreaAttesterId],
});
assert.equal(
  attesterFromBook.toLowerCase(),
  officialDojang.upbitKoreaAttester.toLowerCase(),
  "UPBIT KOREA attester does not match the on-chain DojangAttesterBook mapping",
);

const verified = await client.readContract({
  address: officialDojang.dojangScroll,
  abi: dojangScrollAbi,
  functionName: "isVerified",
  args: [uncredentialedTestAddress, officialDojang.upbitKoreaAttesterId],
});

assert.equal(verified, false, "The synthetic uncredentialed address unexpectedly returned verified");

let uidLookupReverted = false;
try {
  await client.readContract({
    address: officialDojang.dojangScroll,
    abi: dojangScrollAbi,
    functionName: "getVerifiedAddressAttestationUid",
    args: [uncredentialedTestAddress, officialDojang.upbitKoreaAttesterId],
  });
} catch {
  uidLookupReverted = true;
}
assert.equal(uidLookupReverted, true, "Dojang's missing-attestation UID lookup did not revert as expected");

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
  dojangAttesterBookAddress: officialDojang.dojangAttesterBook,
  onchainUpbitAttester: attesterFromBook,
  easAddress: officialDojang.eas,
  verified,
  uidLookupForUnverifiedAddressReverted: uidLookupReverted,
  zeroUidValid: emptyValidity,
  zeroUidAttestationEmpty: emptyAttestation.uid === zeroHash,
  result: "live DojangScroll status and EAS validity/tuple reads passed for an uncredentialed test address",
  integrationNote: "Dojang UID lookup is conditional on isVerified=true; this RPC reverts for the checked missing credential.",
  scope: "No credentialed wallet was supplied; this run does not claim a live positive attestation read.",
}, null, 2)}\n`);
