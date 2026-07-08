import { RoadmapNode } from "./RoadmapNode";
import type { RoadmapChapter } from "../../../types";

interface RoadmapTrackProps {
  chapters: RoadmapChapter[];
  onSelectChapter: (chapter: RoadmapChapter) => void;
}

export const RoadmapTrack = ({
  chapters,
  onSelectChapter,
}: RoadmapTrackProps) => {
  return (
    <div className="relative w-full max-w-3xl mx-auto py-8">
      {/* Central vertical line (visible on md+) */}
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
        <div className="h-full w-full bg-gradient-to-b from-bitcoin/40 via-border to-border" />
      </div>

      {/* Left rail line (visible on mobile) */}
      <div className="md:hidden absolute left-7 top-0 bottom-0 w-px">
        <div className="h-full w-full bg-gradient-to-b from-bitcoin/40 via-border to-border" />
      </div>

      {/* Nodes */}
      <div className="flex flex-col gap-8 md:gap-12">
        {chapters.map((chapter, index) => {
          const isLeft = index % 2 === 0;

          return (
            <div
              key={chapter.id}
              className={`relative flex w-full
                md:px-0 pl-0
                ${isLeft ? "md:pr-[50%] md:pl-0" : "md:pl-[50%] md:pr-0"}
              `}
            >
              {/* Connector dot on the center line (desktop) */}
              <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-colors
                    ${
                      chapter.status === "completed"
                        ? "bg-terminal border-terminal"
                        : chapter.status === "available"
                        ? "bg-bitcoin border-bitcoin"
                        : "bg-muted border-border"
                    }
                  `}
                />
              </div>

              {/* Horizontal connector arm (desktop) */}
              <div
                className={`hidden md:block absolute top-1/2 -translate-y-1/2 h-px w-8
                  ${
                    chapter.status === "completed"
                      ? "bg-terminal/40"
                      : chapter.status === "available"
                      ? "bg-bitcoin/40"
                      : "bg-border"
                  }
                  ${isLeft ? "right-[50%] mr-1.5" : "left-[50%] ml-1.5"}
                `}
              />

              <div
                className={`w-full ${
                  isLeft ? "md:pr-8" : "md:pl-8"
                } pl-0`}
              >
                <RoadmapNode
                  chapter={chapter}
                  index={index}
                  isLeft={isLeft}
                  onSelect={onSelectChapter}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* End marker */}
      <div className="flex justify-center mt-8">
        <div className="w-6 h-6 rounded-full bg-muted border-2 border-border flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
};

export default RoadmapTrack;
