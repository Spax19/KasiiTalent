import { redirect } from "next/navigation";
import { Suspense } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CandidateGrid from "@/components/employer/CandidateGrid";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";
import { getSharedContact } from "@/services/contact";
import { listVisibleCandidates } from "@/services/candidates";
import { requestWorkerContact } from "./actions";

export const metadata = { title: "Find local talent · KasiTalent" };

export default function EmployerPage() {
  return (
    <Suspense fallback={null}>
      <EmployerContent />
    </Suspense>
  );
}

async function EmployerContent() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=%2Femployer");
  if (user.role !== "employer") redirect("/");

  const [candidates, requestsSnapshot] = await Promise.all([
    listVisibleCandidates(),
    adminDb().collection(COL.contactRequests).where("employerUid", "==", user.uid).limit(30).get(),
  ]);
  const requests = await Promise.all(
    requestsSnapshot.docs
      .sort((a, b) => (b.get("createdAt")?.toMillis?.() ?? 0) - (a.get("createdAt")?.toMillis?.() ?? 0))
      .map(async (doc) => {
        const worker = await adminDb().collection(COL.users).doc(doc.get("workerUid") as string).get();
        const status = doc.get("status") as string;
        return {
          id: doc.id,
          title: (doc.get("serviceTitle") as string) ?? "Contact request",
          status,
          workerName: (worker.get("displayName") as string) ?? "Worker",
          phone: status === "accepted" ? await getSharedContact(doc.id, user.uid) : null,
        };
      }),
  );

  return (
    <main>
      <Typography component="h1" variant="h4" fontWeight={800} sx={{ px: { xs: 2, md: 4 }, pt: 4 }}>
        Find local talent
      </Typography>
      {requests.length > 0 && (
        <Box component="section" sx={{ px: { xs: 2, md: 4 }, pt: 3 }}>
          <Typography component="h2" variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Your service requests</Typography>
          <Stack spacing={1.5}>
            {requests.map((request) => (
              <Paper key={request.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography fontWeight={700}>{request.title} · {request.workerName}</Typography>
                    {request.phone && (
                      <Typography component="a" href={`tel:${request.phone}`} color="primary" sx={{ display: "inline-block", mt: 0.5 }}>
                        Call {request.phone}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={request.status === "accepted" ? "Accepted · contact shared" : request.status === "declined" ? "Declined" : "Waiting for worker"}
                    color={request.status === "accepted" ? "success" : "default"}
                    size="small"
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}
      <CandidateGrid candidates={candidates} onRequestContact={requestWorkerContact} />
    </main>
  );
}