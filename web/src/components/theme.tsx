"use client";

import { Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const dark = ready && resolvedTheme === "dark";
  return (
    <button
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full sm:h-9 sm:w-9 border border-line bg-card text-ink-2 transition hover:text-ink"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
