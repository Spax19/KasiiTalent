import { redirect } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { requestContact, setSavedCandidate } from "@/app/actions/employer";
import ColorModeToggle from "@/components/ColorModeToggle";
import CandidateGrid from "@/components/employer/CandidateGrid";
import EmployerSidebar from "@/components/employer/EmployerSidebar";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import { loadCandidates } from "@/services/candidates";

export const dynamic = "force-dynamic";
export const metadata = { title: "Saved candidates · KasiTalent" };

function createdAtMillis(doc: FirebaseFirestore.QueryDocumentSnapshot): number {
  const createdAt = doc.get("createdAt") as { toMillis?: () => number } | undefined;
  return createdAt?.toMillis?.() ?? 0;
}

export default async function SavedCandidatesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/saved");
  if (user.role === "worker") redirect("/worker/dashboard");
  if (user.role !== "employer") redirect("/login?next=/saved");

  const db = adminDb();
  const [profile, savedSnapshot] = await Promise.all([
    db.collection(COL.users).doc(user.uid).get(),
    db.collection(COL.savedCandidates).where("employerUid", "==", user.uid).get(),
  ]);
  const employerName = String(profile.get("businessName") || profile.get("displayName") || "Employer");
  const savedDocs = [...savedSnapshot.docs].sort((a, b) => createdAtMillis(b) - createdAtMillis(a));
  const savedCandidateIds = savedDocs.map((doc) => String(doc.get("workerUid") ?? "")).filter(Boolean);
  const loadedCandidates = await loadCandidates(undefined, savedCandidateIds);
  const candidatesById = new Map(loadedCandidates.map((candidate) => [candidate.id, candidate]));
  const candidates = savedCandidateIds
    .map((candidateId) => candidatesById.get(candidateId))
    .filter((candidate) => candidate !== undefined);
  const visibleSavedIds = candidates.map((candidate) => candidate.id);

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <EmployerSidebar active="saved" />
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
        <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
          <Typography variant="h4" component="h1" fontWeight={800}>Saved candidates</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Keep track of workers you may want to contact. You can remove a candidate at any time.
          </Typography>
          <CandidateGrid
            candidates={candidates}
            savedCandidateIds={visibleSavedIds}
            savedOnly
            onRequestContact={requestContact}
            onToggleSaved={setSavedCandidate}
          />
        </Container>
      </Box>
    </Box>
  );
}
