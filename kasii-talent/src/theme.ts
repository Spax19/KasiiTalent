"use client";

import { createTheme } from "@mui/material/styles";

// Warm amber primary (readable on white), near-black secondary. System fonts keep page weight low.
const theme = createTheme({
  palette: {
    primary: { main: "#b45309" },
    secondary: { main: "#1c1917" },
    background: { default: "#fafaf9" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    button: { textTransform: "none", fontWeight: 600 },
  },
});

export default theme;
