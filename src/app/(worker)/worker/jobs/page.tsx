import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ColorModeToggle from "@/components/ColorModeToggle";
import JobOpportunities from "@/components/worker/JobOpportunities";
import WorkerSidebar from "@/components/worker/WorkerSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import type { JobPostingDTO, WorkerJobApplicationDTO } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find jobs · KasiTalent" };

function isoDate(value: { toDate?: () => Date } | undefined): string {
  return value?.toDate ? value.toDate().toISOString() : new Date(0).toISOString();
}

function createdAtMillis(doc: FirebaseFirestore.QueryDocumentSnapshot): number {
  const createdAt = doc.get("createdAt") as { toMillis?: () => number } | undefined;
  return createdAt?.toMillis?.() ?? 0;
}

export default async function WorkerJobsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/worker/login");
  if (user.role === "employer") redirect("/jobs");
  if (user.role !== "worker") redirect("/worker/login");

  const db = adminDb();
  const [jobsSnapshot, applicationsSnapshot] = await Promise.all([
    db.collection(COL.jobs).where("status", "==", "open").get(),
    db.collection(COL.jobApplications).where("workerUid", "==", user.uid).get(),
  ]);
  const applications: WorkerJobApplicationDTO[] = applicationsSnapshot.docs.map((doc) => ({
    id: String(doc.get("jobId") ?? ""),
    jobTitle: String(doc.get("jobTitle") ?? ""),
    township: String(doc.get("township") ?? ""),
    message: String(doc.get("message") ?? ""),
    status: doc.get("status") === "accepted" || doc.get("status") === "declined" ? doc.get("status") : "pending",
    createdAt: isoDate(doc.get("createdAt")),
  }));
  const appliedJobIds = new Set(applications.map((application) => application.id));
  const now = Date.now();
  const jobs: JobPostingDTO[] = jobsSnapshot.docs
    .filter((doc) => {
      const expiry = doc.get("expiresAt") as { toMillis?: () => number } | undefined;
      return !expiry?.toMillis || expiry.toMillis() > now;
    })
    .sort((a, b) => createdAtMillis(b) - createdAtMillis(a))
    .map((doc) => {
      const job = doc.data();
      return {
        id: doc.id,
        employerName: String(job.employerName ?? "Local employer"),
        title: String(job.title ?? ""),
        description: String(job.description ?? ""),
        skillSlugs: Array.isArray(job.skillSlugs) ? job.skillSlugs.map(String) : [],
        paymentType: job.paymentType === "hourly" || job.paymentType === "daily" ? job.paymentType : "fixed",
        payAmountZar: Number(job.payAmountZar ?? 0),
        township: String(job.township ?? ""),
        radiusKm: Number(job.radiusKm ?? 25),
        status: "open",
        startDate: job.startDate?.toDate ? job.startDate.toDate().toISOString() : null,
        expiresAt: isoDate(job.expiresAt),
        createdAt: isoDate(job.createdAt),
        applicantCount: Number(job.applicantCount ?? 0),
      };
    });
  const applicationsById = applications.filter((application) => appliedJobIds.has(application.id));

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <WorkerSidebar active="jobs" />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Box component="header" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Container maxWidth="xl" sx={{ py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Box>
            <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>KasiTalent</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>WORKER OPPORTUNITIES</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button component="a" href="/worker/dashboard" size="small">My profile</Button>
            <ColorModeToggle />
            <SignOutButton redirectTo="/worker/login" />
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Typography variant="h4" component="h1" fontWeight={800}>Find work near you</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
          Browse local openings, send an application, and check the employer&apos;s response here.
        </Typography>
        <JobOpportunities jobs={jobs} applications={applicationsById} />
      </Container>
      </Box>
    </Box>
  );
}
