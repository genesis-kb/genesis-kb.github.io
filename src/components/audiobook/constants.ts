/**
 * Shared audiobook constants and utilities
 * Extracted to avoid duplication across audiobook components
 */

export const difficultyConfig = {
  beginner: {
    label: "Beginner",
    color: "bg-terminal/10 text-terminal border-terminal/30",
  },
  intermediate: {
    label: "Intermediate",
    color: "bg-bitcoin/10 text-bitcoin border-bitcoin/30",
  },
  advanced: {
    label: "Advanced",
    color: "bg-destructive/10 text-destructive border-destructive/30",
  },
} as const;

/**
 * Format a duration in seconds to a human-readable string.
 * Handles hours, minutes, and seconds.
 */
export const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};
