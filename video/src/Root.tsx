import React from "react";
import { Composition, Series } from "remotion";
import {
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  VIDEO_FPS,
  SCENE_FRAMES,
  TOTAL_FRAMES,
} from "./design-tokens";
import { Scene1BrandReveal } from "./scenes/Scene1-BrandReveal";
import { Scene2Dashboard } from "./scenes/Scene2-Dashboard";
import { Scene3Trades } from "./scenes/Scene3-Trades";
import { Scene4Journal } from "./scenes/Scene4-Journal";
import { Scene5AIAssistant } from "./scenes/Scene5-AIAssistant";
import { Scene6Edges } from "./scenes/Scene6-Edges";
import { Scene7Goals } from "./scenes/Scene7-Goals";
import { Scene8Reports } from "./scenes/Scene8-Reports";
import { Scene9Closing } from "./scenes/Scene9-Closing";

const ProductVideo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={SCENE_FRAMES.brandReveal}>
        <Scene1BrandReveal />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.dashboard}>
        <Scene2Dashboard />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.trades}>
        <Scene3Trades />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.journal}>
        <Scene4Journal />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.aiAssistant}>
        <Scene5AIAssistant />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.edges}>
        <Scene6Edges />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.goals}>
        <Scene7Goals />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.reports}>
        <Scene8Reports />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENE_FRAMES.closing}>
        <Scene9Closing />
      </Series.Sequence>
    </Series>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Full video */}
      <Composition
        id="ProductVideo"
        component={ProductVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />

      {/* Individual scenes for preview */}
      <Composition
        id="Scene1-BrandReveal"
        component={Scene1BrandReveal}
        durationInFrames={SCENE_FRAMES.brandReveal}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene2-Dashboard"
        component={Scene2Dashboard}
        durationInFrames={SCENE_FRAMES.dashboard}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene3-Trades"
        component={Scene3Trades}
        durationInFrames={SCENE_FRAMES.trades}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene4-Journal"
        component={Scene4Journal}
        durationInFrames={SCENE_FRAMES.journal}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene5-AIAssistant"
        component={Scene5AIAssistant}
        durationInFrames={SCENE_FRAMES.aiAssistant}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene6-Edges"
        component={Scene6Edges}
        durationInFrames={SCENE_FRAMES.edges}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene7-Goals"
        component={Scene7Goals}
        durationInFrames={SCENE_FRAMES.goals}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene8-Reports"
        component={Scene8Reports}
        durationInFrames={SCENE_FRAMES.reports}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
      <Composition
        id="Scene9-Closing"
        component={Scene9Closing}
        durationInFrames={SCENE_FRAMES.closing}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
    </>
  );
};
