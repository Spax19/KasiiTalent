import type { Metadata, Viewport } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import ColorModeProvider from "@/components/ColorModeProvider";

export const metadata: Metadata = {
  title: "KasiTalent",
  description: "Show your skills. Get hired locally. WhatsApp-first profiles for South Africa's informal workers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ColorModeProvider>
            {children}
          </ColorModeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
