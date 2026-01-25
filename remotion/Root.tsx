import { Composition } from 'remotion';
import { ScannerDemo } from './compositions/ScannerDemo';
import { StudioDemo } from './compositions/StudioDemo';
import { BagsFullDemo } from './compositions/BagsFullDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BagsFullDemo"
        component={BagsFullDemo}
        durationInFrames={1680}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="ScannerDemo"
        component={ScannerDemo}
        durationInFrames={660}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="StudioDemo"
        component={StudioDemo}
        durationInFrames={780}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="BagsFullDemo-Mobile"
        component={BagsFullDemo}
        durationInFrames={1680}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="BagsFullDemo-Square"
        component={BagsFullDemo}
        durationInFrames={1680}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
