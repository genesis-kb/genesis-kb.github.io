import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { motion } from "framer-motion";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-10 h-10 rounded-lg border border-border bg-secondary flex items-center justify-center hover:border-primary/40 transition-colors"
      aria-label={`Theme: ${theme}. Click to cycle theme.`}
    >
      <motion.div
        initial={false}
        animate={{ scale: [0.8, 1], opacity: [0, 1] }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        key={theme}
      >
        {theme === "dark" ? (
          <Moon className="w-4 h-4 text-signal" />
        ) : theme === "system" ? (
          <Monitor className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Sun className="w-4 h-4 text-bitcoin" />
        )}
      </motion.div>
    </button>
  );
};
