import assert from "node:assert/strict";
import {
  createPublicClient,
  encodeAbiParameters,
  http,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
  zeroHash,
} from "viem";
import { dojangAttesterBookAbi, easAbi, dojangScrollAbi } from "../src/lib/contracts/abis";
import { officialDojang } from "../src/lib/config/contracts";
import { giwaSepolia, GIWA_CHAIN_ID } from "../src/lib/config/chain";
import { decodeVerifiedAddressContent } from "../src/lib/protocol/dojang-content";

const rpcUrl = "https://sepolia-rpc.giwa.io";
const client = createPublicClient({ chain: giwaSepolia, transport: http(rpcUrl, { timeout: 15_000 }) });
const easSchemaRegistryAbi = parseAbi(["function getSchemaRegistry() view returns (address)"]);
const schemaRegistryAbi = parseAbi([
  "function getSchema(bytes32 uid) view returns ((bytes32 uid,address resolver,bool revocable,string schema))",
]);
const uncredentialedTestAddress = "0x000000000000000000000000000000000000dEaD" as const;
const trueContent = encodeAbiParameters(parseAbiParameters("bool"), [true]);
const falseContent = encodeAbiParameters(parseAbiParameters("bool"), [false]);
assert.equal(decodeVerifiedAddressContent(trueContent), true, "Verified Address true content did not decode");
assert.equal(decodeVerifiedAddressContent(falseContent), false, "Verified Address false content did not decode");
assert.equal(decodeVerifiedAddressContent("0x"), undefined, "Malformed Verified Address content was accepted");

const chainId = await client.getChainId();
assert.equal(chainId, GIWA_CHAIN_ID, `Unexpected chain id from ${rpcUrl}`);
const blockNumber = await client.getBlockNumber();
const [block, dependencyCode] = await Promise.all([
  client.getBlock({ blockNumber }),
  Promise.all([
    officialDojang.dojangScroll,
    officialDojang.dojangAttesterBook,
    officialDojang.eas,
  ].map((address) => client.getCode({ address, blockNumber }))),
]);
for (const [name, code] of [
  ["DojangScroll", dependencyCode[0]],
  ["DojangAttesterBook", dependencyCode[1]],
  ["EAS", dependencyCode[2]],
] as const) {
  assert.ok(code && code !== "0x", `${name} has no code at the configured official address`);
}

const schemaRegistryAddress = await client.readContract({
  address: officialDojang.eas,
  abi: easSchemaRegistryAbi,
  functionName: "getSchemaRegistry",
  blockNumber,
});
assert.notEqual(schemaRegistryAddress, zeroAddress, "EAS returned a zero SchemaRegistry address");
const schemaRegistryCode = await client.getCode({ address: schemaRegistryAddress, blockNumber });
assert.ok(schemaRegistryCode && schemaRegistryCode !== "0x", "EAS SchemaRegistry has no code");

const schemaRecord = await client.readContract({
  address: schemaRegistryAddress,
  abi: schemaRegistryAbi,
  functionName: "getSchema",
  args: [officialDojang.verifiedAddressSchemaUid],
  blockNumber,
});
assert.equal(
  schemaRecord.uid.toLowerCase(),
  officialDojang.verifiedAddressSchemaUid.toLowerCase(),
  "The configured Verified Address schema UID was not returned by EAS SchemaRegistry",
);
assert.equal(schemaRecord.schema, "bool isVerified", "Unexpected Verified Address schema definition");

const attesterFromBook = await client.readContract({
  address: officialDojang.dojangAttesterBook,
  abi: dojangAttesterBookAbi,
  functionName: "getAttester",
  args: [officialDojang.upbitKoreaAttesterId],
  blockNumber,
});
assert.notEqual(attesterFromBook, zeroAddress, "UPBIT KOREA attester ID has no trusted on-chain mapping");

const verified = await client.readContract({
  address: officialDojang.dojangScroll,
  abi: dojangScrollAbi,
  functionName: "isVerified",
  args: [uncredentialedTestAddress, officialDojang.upbitKoreaAttesterId],
  blockNumber,
});

assert.equal(verified, false, "The synthetic uncredentialed address unexpectedly returned verified");

let uidLookupReverted = false;
try {
  await client.readContract({
    address: officialDojang.dojangScroll,
    abi: dojangScrollAbi,
    functionName: "getVerifiedAddressAttestationUid",
    args: [uncredentialedTestAddress, officialDojang.upbitKoreaAttesterId],
    blockNumber,
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
    blockNumber,
  }),
  client.readContract({
    address: officialDojang.eas,
    abi: easAbi,
    functionName: "getAttestation",
    args: [zeroHash],
    blockNumber,
  }),
]);

assert.equal(emptyValidity, false, "EAS reported the zero UID as valid");
assert.equal(emptyAttestation.uid, zeroHash, "EAS returned a non-empty zero-UID attestation");

process.stdout.write(`${JSON.stringify({
  rpcUrl,
  chainId,
  blockNumber: blockNumber.toString(),
  blockTimestamp: block.timestamp.toString(),
  checkedAddress: uncredentialedTestAddress,
  dojangScrollAddress: officialDojang.dojangScroll,
  dojangAttesterBookAddress: officialDojang.dojangAttesterBook,
  easSchemaRegistryAddress: schemaRegistryAddress,
  verifiedAddressSchema: schemaRecord.schema,
  verifiedAddressSchemaUid: schemaRecord.uid,
  verifiedAddressSchemaRevocable: schemaRecord.revocable,
  upbitKoreaAttesterId: officialDojang.upbitKoreaAttesterId,
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
