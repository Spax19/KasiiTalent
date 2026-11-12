import { redirect } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ColorModeToggle from "@/components/ColorModeToggle";
import JobsManager from "@/components/employer/JobsManager";
import EmployerSidebar from "@/components/employer/EmployerSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import type { JobPostingDTO } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My jobs · KasiTalent" };

function isoDate(value: { toDate?: () => Date } | undefined): string {
  return value?.toDate ? value.toDate().toISOString() : new Date(0).toISOString();
}

function createdAtMillis(doc: FirebaseFirestore.QueryDocumentSnapshot): number {
  const createdAt = doc.get("createdAt") as { toMillis?: () => number } | undefined;
  return createdAt?.toMillis?.() ?? 0;
}

export default async function EmployerJobsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/jobs");
  if (user.role === "worker") redirect("/worker/jobs");
  if (user.role !== "employer") redirect("/login?next=/jobs");

  const db = adminDb();
  const [profile, jobsSnapshot] = await Promise.all([
    db.collection(COL.users).doc(user.uid).get(),
    db.collection(COL.jobs).where("employerUid", "==", user.uid).get(),
  ]);
  const employerName = String(profile.get("businessName") || profile.get("displayName") || "Employer");
  const jobs: JobPostingDTO[] = [...jobsSnapshot.docs].sort((a, b) => createdAtMillis(b) - createdAtMillis(a)).map((doc) => {
    const job = doc.data();
    return {
      id: doc.id,
      employerName,
      title: String(job.title ?? ""),
      description: String(job.description ?? ""),
      skillSlugs: Array.isArray(job.skillSlugs) ? job.skillSlugs.map(String) : [],
      paymentType: job.paymentType === "hourly" || job.paymentType === "daily" ? job.paymentType : "fixed",
      payAmountZar: Number(job.payAmountZar ?? 0),
      township: String(job.township ?? ""),
      radiusKm: Number(job.radiusKm ?? 25),
      status: job.status === "filled" || job.status === "closed" || job.status === "expired" ? job.status : "open",
      startDate: job.startDate?.toDate ? job.startDate.toDate().toISOString() : null,
      expiresAt: isoDate(job.expiresAt),
      createdAt: isoDate(job.createdAt),
      applicantCount: Number(job.applicantCount ?? 0),
    };
  });

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <EmployerSidebar active="jobs" />
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
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Typography variant="h4" component="h1" fontWeight={800}>My jobs</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
          Publish your openings and manage the workers who apply.
        </Typography>
        <JobsManager jobs={jobs} />
      </Container>
      </Box>
    </Box>
  );
}
