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
import {
  generateEligibilityProof,
  validateEligibilityWitness,
} from "../../src/lib/zk/eligibility-prover";

interface BrowserFlowInput {
  rpcUrl: string;
  vault: Address;
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

export async function runBrowserLocalFlow(input: BrowserFlowInput) {
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
  const proof = await generateEligibilityProof(input.witness, context);
  const proofElapsedMs = Math.round(performance.now() - startedAt);

  let underThresholdRejected = false;
  try {
    await validateEligibilityWitness({ ...input.witness, privateValue: "999" }, context);
  } catch {
    underThresholdRejected = true;
  }
  if (!underThresholdRejected) throw new Error("Browser prover accepted an under-threshold witness.");

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
  const transactionHash = await walletClient.writeContract({
    address: input.vault,
    abi: restrictedVaultAbi,
    functionName: "enterVault",
    args: [proof.proof, [...proof.publicInputs]],
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

  return {
    proofElapsedMs,
    proofBytes: (proof.proof.length - 2) / 2,
    publicInputCount: proof.publicInputs.length,
    localVerification: proof.localVerification,
    underThresholdRejected,
    transactionHash,
    transactionStatus: receipt.status,
    blockNumber: receipt.blockNumber.toString(),
    hasAccess,
  };
}
