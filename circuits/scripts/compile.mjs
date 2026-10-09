import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile_program, createFileManager } from "@noir-lang/noir_wasm";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, "../private_eligibility");
const output = path.resolve(here, "../../public/circuits/private_eligibility.json");
const verifierOutput = path.resolve(here, "../../contracts/src/generated/EligibilityHonkVerifier.sol");
const crsPath = path.resolve(here, "../cache/bb-crs");
const fileManager = createFileManager(project);
const artifacts = await compile_program(fileManager, undefined, (message) => process.stderr.write(`${message}\n`));

if (artifacts.warnings.length > 0) {
  for (const warning of artifacts.warnings) process.stderr.write(`${String(warning)}\n`);
}

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(artifacts.program));

const api = await Barretenberg.new({ threads: 1, crsPath });
try {
  const backend = new UltraHonkBackend(artifacts.program.bytecode, api);
  const options = { verifierTarget: "evm" };
  const verificationKey = await backend.getVerificationKey(options);
  const verifierSource = await backend.getSolidityVerifier(verificationKey, options);
  await mkdir(path.dirname(verifierOutput), { recursive: true });
  await writeFile(verifierOutput, verifierSource);
} finally {
  await api.destroy();
}

process.stdout.write(`Compiled private_eligibility; artifact: ${output}; EVM verifier: ${verifierOutput}\n`);
