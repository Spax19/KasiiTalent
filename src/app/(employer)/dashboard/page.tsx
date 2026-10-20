// Path: src/app/(employer)/dashboard/page.tsx
// Server Component: queries Firestore (Admin SDK), builds browser-safe DTOs, renders the grid.
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import SignOutButton from "@/components/auth/SignOutButton";
import { adminDb, COL } from "@/lib/firebase/admin";
import { getSessionUser, requireUser } from "@/lib/auth";
import { notifyContactRequest } from "@/services/contact";
import CandidateGrid from "@/components/employer/CandidateGrid";
import type { CandidateDTO } from "@/types";

export const dynamic = "force-dynamic";

async function loadCandidates(townshipSlug?: string): Promise<CandidateDTO[]> {
  const db = adminDb();

  let q = db
    .collection(COL.users)
    .where("role", "==", "worker")
    .where("visibility", "==", "visible"); // only workers who consented to sharing
  if (townshipSlug) q = q.where("townshipSlug", "==", townshipSlug);
  const users = await q.orderBy("ratingAvg", "desc").limit(30).get(); // Firestore `in` supports up to 30 values

  if (users.empty) return [];
  const ids = users.docs.map((d) => d.id);

  const [skillsSnap, mediaSnap] = await Promise.all([
    db.collection(COL.skills).where("uid", "in", ids).get(),
    // Only moderated media is shown to employers.
    db.collection(COL.media).where("uid", "in", ids).where("moderationStatus", "==", "approved").get(),
  ]);

  const skillsByUid = new Map<string, CandidateDTO["skills"]>();
  skillsSnap.forEach((d) => {
    const s = d.data();
    const list = skillsByUid.get(s.uid) ?? [];
    list.push({ slug: s.skillSlug, label: s.label, status: s.verificationStatus, yearsExperience: s.yearsExperience });
    skillsByUid.set(s.uid, list);
  });

  const mediaByUid = new Map<string, CandidateDTO["media"]>();
  mediaSnap.docs
    .sort((a, b) => (b.get("createdAt")?.toMillis() ?? 0) - (a.get("createdAt")?.toMillis() ?? 0))
    .forEach((d) => {
      const m = d.data();
      const list = mediaByUid.get(m.uid) ?? [];
      if (list.length < 6) {
        list.push({ id: d.id, type: m.type, url: m.secureUrl, thumbnailUrl: m.thumbnailUrl, caption: m.caption, skillSlug: m.skillSlug });
        mediaByUid.set(m.uid, list);
      }
    });

  return users.docs.map((d) => {
    const u = d.data();
    return {
      id: d.id,
      displayName: u.displayName,
      township: u.township,
      bio: u.bio,
      ratingAvg: u.ratingAvg,
      ratingCount: u.ratingCount,
      endorsementCount: u.endorsementCount,
      skills: skillsByUid.get(d.id) ?? [],
      media: mediaByUid.get(d.id) ?? [],
      memberSince: u.createdAt.toDate().toISOString(),
      // NOTE: no phone number, no uid-to-phone mapping, ever reaches the browser.
    };
  });
}

/** Server Action: creates a request; the worker gets a WhatsApp message and must reply "1" to share their number. */
async function requestContact(workerUid: string) {
  "use server";
  const employer = await requireUser("employer");
  const ref = await adminDb().collection(COL.contactRequests).add({
    employerUid: employer.uid,
    workerUid,
    status: "sent",
    createdAt: FieldValue.serverTimestamp(),
  });
  // Template message (or text within the 24h window). The number is only released to the
  // employer after the worker replies 1: see getSharedContact() in services/contact.ts.
  await notifyContactRequest(ref.id);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ township?: string }>;
}) {
  // Not logged in (or not an employer): send to the login page, which returns here afterwards.
  const user = await getSessionUser();
  if (!user || user.role !== "employer") redirect("/login?next=/dashboard");

  const { township } = await searchParams;
  const candidates = await loadCandidates(township);

  return (
    <Box component="main" sx={{ minHeight: "100vh" }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
            KasiTalent
          </Typography>
          <SignOutButton />
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ pt: 4 }}>
        <Typography variant="h4" component="h1" fontWeight={800}>
          Find local talent
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Skilled people from your kasi, with proof of their work.
        </Typography>
      </Container>
      <CandidateGrid candidates={candidates} onRequestContact={requestContact} />
    </Box>
  );
}
