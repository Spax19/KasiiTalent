"use client";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { useColorMode } from "@/components/ColorModeProvider";

export default function ColorModeToggle() {
  const { mode, toggleMode } = useColorMode();
  const nextMode = mode === "light" ? "dark" : "light";

  return (
    <Tooltip title={`Switch to ${nextMode} mode`}>
      <IconButton
        onClick={toggleMode}
        color="inherit"
        aria-label={`Switch to ${nextMode} mode`}
        size="small"
      >
        {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
