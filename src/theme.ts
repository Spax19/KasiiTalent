import { createTheme, type PaletteMode } from "@mui/material/styles";

export default function createAppTheme(mode: PaletteMode) {
  const isLight = mode === "light";

  return createTheme({
    palette: {
      mode,
      primary: { main: isLight ? "#b45309" : "#fbbf24" },
      secondary: { main: isLight ? "#292524" : "#f5f5f4" },
      background: {
        default: isLight ? "#fafaf9" : "#121212",
        paper: isLight ? "#ffffff" : "#1e1e1e",
      },
      divider: isLight ? "#e7e5e4" : "#383838",
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { borderColor: isLight ? "#e7e5e4" : "#383838" },
        },
      },
    },
  });
}
