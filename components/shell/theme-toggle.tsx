"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDarkTheme, setTheme, subscribeTheme } from "@/lib/theme";

const serverSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDarkTheme, serverSnapshot);
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => setTheme(dark ? "light" : "dark")}>
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}
