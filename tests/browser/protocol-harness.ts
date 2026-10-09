import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
} from "viem";
import { restrictedVaultAbi } from "../../src/lib/contracts/abis";
import type { DemoCredentialWitness } from "../../src/lib/credential/witness";
import type { PublicProofInputs } from "../../src/lib/protocol/types";
import type { EligibilityPublicInputs } from "../../src/lib/protocol/types";
import {
  generateEligibilityProof,
  validateEligibilityWitness,
} from "../../src/lib/zk/eligibility-prover";

interface BrowserFlowInput {
  rpcUrl: string;
  vault: Address;
  attacker: Address;
  outsider: Address;
  witness: DemoCredentialWitness;
  context: Omit<PublicProofInputs, "policyId" | "policyVersion" | "threshold" | "credentialVersion" | "expiresAt" | "chainId"> & {
    policyId: string;
    policyVersion: string;
    threshold: string;
    credentialVersion: string;
    expiresAt: string;
    chainId: string;
  };
}

export interface BrowserFlowResult {
  proofElapsedMs: number;
  proofBytes: number;
  publicInputCount: number;
  localVerification: "verified";
  underThresholdRejected: boolean;
  invalidProofRejected: boolean;
  wrongWalletRejected: boolean;
  missingCredentialRejected: boolean;
  transactionHash: `0x${string}`;
  transactionStatus: "success";
  blockNumber: string;
  hasAccess: boolean;
  replayRejected: boolean;
}

export async function runBrowserLocalFlow(input: BrowserFlowInput): Promise<BrowserFlowResult> {
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "starting browser prover";
  const context: PublicProofInputs = {
    ...input.context,
    policyId: BigInt(input.context.policyId),
    policyVersion: BigInt(input.context.policyVersion),
    threshold: BigInt(input.context.threshold),
    credentialVersion: BigInt(input.context.credentialVersion),
    expiresAt: BigInt(input.context.expiresAt),
    chainId: BigInt(input.context.chainId),
  };
  const startedAt = performance.now();
  const proof = await generateEligibilityProof(input.witness, context, (stage) => {
    (window as Window & { giwaTestProgress?: string }).giwaTestProgress = stage;
  });
  const proofElapsedMs = Math.round(performance.now() - startedAt);
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "proof generated and locally verified";

  let underThresholdRejected = false;
  try {
    await validateEligibilityWitness({ ...input.witness, privateValue: "999" }, context);
  } catch {
    underThresholdRejected = true;
  }
  if (!underThresholdRejected) throw new Error("Browser prover accepted an under-threshold witness.");
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "under-threshold witness rejected";

  const chain = defineChain({
    id: 91_342,
    name: "GIWA Sepolia local protocol test",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [input.rpcUrl] } },
  });
  const publicClient = createPublicClient({ chain, transport: http(input.rpcUrl) });
  const walletClient = createWalletClient({
    account: input.witness.wallet,
    chain,
    transport: http(input.rpcUrl),
  });

  const invalidProof = `0x${"00".repeat((proof.proof.length - 2) / 2)}` as const;
  const invalidProofRejected = await publicClient.simulateContract({
    account: input.witness.wallet,
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "enterVault",
    args: [invalidProof, [...proof.publicInputs] as EligibilityPublicInputs],
  }).then(() => false, () => true);
  if (!invalidProofRejected) throw new Error("RestrictedVault accepted invalid proof bytes.");
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "invalid on-chain proof rejected";

  const wrongWalletRejected = await publicClient.simulateContract({
    account: input.attacker,
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "enterVault",
    args: [proof.proof, [...proof.publicInputs] as EligibilityPublicInputs],
  }).then(() => false, () => true);
  if (!wrongWalletRejected) throw new Error("RestrictedVault accepted a proof for another wallet.");
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "wrong-wallet proof rejected";

  const missingCredentialRejected = await publicClient.simulateContract({
    account: input.outsider,
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "enterVault",
    args: [proof.proof, [...proof.publicInputs] as EligibilityPublicInputs],
  }).then(() => false, () => true);
  if (!missingCredentialRejected) throw new Error("RestrictedVault accepted an account without a credential.");

  const transactionHash = await walletClient.writeContract({
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "enterVault",
    args: [proof.proof, [...proof.publicInputs] as EligibilityPublicInputs],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  const hasAccess = await publicClient.readContract({
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "hasAccess",
    args: [input.witness.wallet],
  });

  if (receipt.status !== "success") throw new Error("The local vault transaction did not succeed.");
  if (!hasAccess) throw new Error("The local vault did not record access after the successful receipt.");
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "vault transaction confirmed and read back";

  const replayRejected = await publicClient.simulateContract({
    account: input.witness.wallet,
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "enterVault",
    args: [proof.proof, [...proof.publicInputs] as EligibilityPublicInputs],
  }).then(() => false, () => true);
  if (!replayRejected) throw new Error("RestrictedVault accepted a replay after access was granted.");
  (window as Window & { giwaTestProgress?: string }).giwaTestProgress = "replay rejected";

  return {
    proofElapsedMs,
    proofBytes: (proof.proof.length - 2) / 2,
    publicInputCount: proof.publicInputs.length,
    localVerification: "verified",
    underThresholdRejected,
    invalidProofRejected,
    wrongWalletRejected,
    missingCredentialRejected,
    transactionHash,
    transactionStatus: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
    hasAccess,
    replayRejected,
  };
}
