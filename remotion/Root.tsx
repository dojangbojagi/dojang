import { Composition } from "remotion";
import { FontGate } from "./lib/fonts";
import { FPS, H, W } from "./lib/theme";
import { sec } from "./lib/motion";
import cues from "./lib/cues.json";
import { Protocol } from "./compositions/Protocol";
import { Governance } from "./compositions/Governance";
import { Lending } from "./compositions/Lending";

const withFonts = (Component: React.FC) => {
  const Wrapped: React.FC = () => (
    <FontGate>
      <Component />
    </FontGate>
  );
  return Wrapped;
};

const ProtocolVideo = withFonts(Protocol);
const GovernanceVideo = withFonts(Governance);
const LendingVideo = withFonts(Lending);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GyevoProtocol" component={ProtocolVideo} durationInFrames={sec(cues.protocol.duration)} fps={FPS} width={W} height={H} />
    <Composition id="GyevoGovernance" component={GovernanceVideo} durationInFrames={sec(cues.governance.duration)} fps={FPS} width={W} height={H} />
    <Composition id="GyevoLending" component={LendingVideo} durationInFrames={sec(cues.lending.duration)} fps={FPS} width={W} height={H} />
  </>
);
