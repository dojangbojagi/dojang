import { Composition } from "remotion";
import { FontGate } from "./lib/fonts";
import { FPS, H, W } from "./lib/theme";
import { ProtocolProof } from "./compositions/ProtocolProof";

const ProofVideo: React.FC = () => (
  <FontGate>
    <ProtocolProof />
  </FontGate>
);

export const ProtocolProofRoot: React.FC = () => (
  <Composition
    id="GyevoProtocolProof"
    component={ProofVideo}
    durationInFrames={6 * FPS}
    fps={FPS}
    width={W}
    height={H}
  />
);
