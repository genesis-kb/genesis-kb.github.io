import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  Clock,
  BarChart3,
  ArrowRight,
  Headphones,
} from "lucide-react";
import { usePlaylists } from "@/hooks/useAudiobooks";
import { difficultyConfig, formatDuration } from "@/components/audiobook/constants";
import { inferDifficulty, getTopicImageUrl } from "@/components/audiobook/topicUtils";


const Audiobooks = () => {
  const { data: response, isLoading } = usePlaylists({ playlist_type: 'series' });
  const audiobooks = response?.data || [];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-bitcoin/10 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-bitcoin" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Audiobook Learning Paths
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Structured audio courses to master Bitcoin concepts step by step
            </p>
          </div>
        </div>
      </motion.div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-6 animate-pulse"
            >
              <div className="w-full h-40 bg-muted rounded-lg mb-4" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Audiobook grid */}
      {!isLoading && audiobooks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {audiobooks.map((playlist, index) => {
            // Dynamic difficulty: infer from tags/title/description
            const diffKey = inferDifficulty(playlist);
            const difficulty = difficultyConfig[diffKey] || difficultyConfig.beginner;

            return (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Link
                  to={`/learning-path/${playlist.slug}`}
                  className="group block rounded-xl border border-border bg-card overflow-hidden hover:border-bitcoin/40 hover:shadow-lg hover:shadow-bitcoin/5 transition-all duration-300"
                  id={`audiobook-card-${playlist.id}`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full h-44 overflow-hidden">
                    <img
                      src={getTopicImageUrl(playlist)}
                      alt={playlist.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Difficulty badge overlay */}
                    <span
                      className={`absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border backdrop-blur-md ${difficulty.color}`}
                    >
                      <BarChart3 className="w-2.5 h-2.5" />
                      {difficulty.label}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <h2 className="font-display font-semibold text-lg text-foreground group-hover:text-bitcoin transition-colors mb-2">
                      {playlist.title}
                    </h2>
                    {playlist.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {playlist.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {playlist.episode_count} chapters
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(playlist.total_duration_seconds)}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-bitcoin group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && audiobooks.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Headphones className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="font-display text-lg font-semibold text-foreground mb-2">
            No audiobooks available yet
          </h2>
          <p className="text-sm text-muted-foreground">
            Check back soon — new learning paths are being prepared.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default Audiobooks;
