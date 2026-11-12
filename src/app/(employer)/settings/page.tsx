import { redirect } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ColorModeToggle from "@/components/ColorModeToggle";
import EmployerSettingsForm from "@/components/employer/EmployerSettingsForm";
import EmployerSidebar from "@/components/employer/EmployerSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings · KasiTalent" };

export default async function EmployerSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");
  if (user.role === "worker") redirect("/worker/dashboard");
  if (user.role !== "employer") redirect("/login?next=/settings");

  const db = adminDb();
  const [profile, privateProfile] = await Promise.all([
    db.collection(COL.users).doc(user.uid).get(),
    db.collection(COL.userPrivate).doc(user.uid).get(),
  ]);
  const employerName = String(profile.get("businessName") || profile.get("displayName") || "Employer");

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <EmployerSidebar active="settings" />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box component="header" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Container maxWidth="xl" sx={{ py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Box>
              <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>KasiTalent</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>EMPLOYER DASHBOARD</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button component="a" href="/dashboard" size="small">Find talent</Button>
              <ColorModeToggle />
              <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 13, fontWeight: 700 }}>
                {employerName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </Avatar>
              <SignOutButton />
            </Stack>
          </Container>
        </Box>
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
          <Typography variant="h4" component="h1" fontWeight={800}>Account settings</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
            Manage the business details shown to people using KasiTalent.
          </Typography>
          <EmployerSettingsForm
            businessName={String(profile.get("businessName") || profile.get("displayName") || "")}
            businessType={String(profile.get("businessType") ?? "")}
            township={String(profile.get("township") ?? "")}
            city={String(profile.get("city") ?? "")}
            province={String(profile.get("province") ?? "")}
            email={String(privateProfile.get("email") ?? "")}
          />
        </Container>
      </Box>
    </Box>
  );
}
