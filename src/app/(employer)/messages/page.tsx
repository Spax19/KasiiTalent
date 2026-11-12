import { redirect } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ColorModeToggle from "@/components/ColorModeToggle";
import EmployerMessages from "@/components/employer/EmployerMessages";
import EmployerSidebar from "@/components/employer/EmployerSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import type { EmployerJobApplicationDTO } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · KasiTalent" };

function timestampMillis(value: { toMillis?: () => number } | undefined): number {
  return value?.toMillis?.() ?? 0;
}

function isoDate(value: { toDate?: () => Date } | undefined): string {
  return value?.toDate ? value.toDate().toISOString() : new Date(0).toISOString();
}

export default async function EmployerMessagesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/messages");
  if (user.role === "worker") redirect("/worker/jobs");
  if (user.role !== "employer") redirect("/login?next=/messages");

  const db = adminDb();
  const [profile, jobsSnapshot, applicationSnapshot] = await Promise.all([
    db.collection(COL.users).doc(user.uid).get(),
    db.collection(COL.jobs).where("employerUid", "==", user.uid).get(),
    db.collection(COL.jobApplications).where("employerUid", "==", user.uid).get(),
  ]);
  const employerName = String(profile.get("businessName") || profile.get("displayName") || "Employer");
  const jobTitles = new Map(jobsSnapshot.docs.map((doc) => [doc.id, String(doc.get("title") ?? "")]));
  const applicationDocs = [...applicationSnapshot.docs].sort((a, b) =>
    timestampMillis(b.get("createdAt")) - timestampMillis(a.get("createdAt")),
  );
  const workerIds = [...new Set(applicationDocs.map((doc) => String(doc.get("workerUid") ?? "")).filter(Boolean))];
  const workerProfiles = workerIds.length
    ? await db.getAll(...workerIds.map((uid) => db.collection(COL.users).doc(uid)))
    : [];
  const workersById = new Map(workerProfiles.map((doc) => [doc.id, doc]));
  const applications: EmployerJobApplicationDTO[] = applicationDocs.map((doc) => {
    const worker = workersById.get(String(doc.get("workerUid") ?? ""));
    return {
      id: doc.id,
      jobId: String(doc.get("jobId") ?? ""),
      jobTitle: jobTitles.get(String(doc.get("jobId") ?? "")) || String(doc.get("jobTitle") ?? ""),
      workerName: String(worker?.get("displayName") || doc.get("workerName") || "Worker"),
      workerTownship: String(worker?.get("township") || doc.get("workerTownship") || ""),
      message: String(doc.get("message") ?? ""),
      status: doc.get("status") === "accepted" || doc.get("status") === "declined" ? doc.get("status") : "pending",
      createdAt: isoDate(doc.get("createdAt")),
    };
  });

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <EmployerSidebar active="messages" />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box component="header" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
          <Container maxWidth="xl" sx={{ py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
            <Box>
              <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>KasiTalent</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>EMPLOYER DASHBOARD</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button component="a" href="/jobs" size="small">My jobs</Button>
              <ColorModeToggle />
              <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 13, fontWeight: 700 }}>
                {employerName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
              </Avatar>
              <SignOutButton />
            </Stack>
          </Container>
        </Box>
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
          <Typography variant="h4" component="h1" fontWeight={800}>Messages</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
            Read worker applications for each job and respond to applicants.
          </Typography>
          <EmployerMessages applications={applications} />
        </Container>
      </Box>
    </Box>
  );
}
