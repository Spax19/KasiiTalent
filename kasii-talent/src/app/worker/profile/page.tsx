import { redirect } from "next/navigation";
import { Suspense } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import SignOutButton from "@/components/auth/SignOutButton";
import { getSessionUser } from "@/lib/auth";
import { adminDb, COL } from "@/lib/firebase/admin";

export const metadata = { title: "Your worker profile · KasiTalent" };

export default function WorkerProfilePage() {
  return (
    <Suspense fallback={null}>
      <WorkerProfileContent />
    </Suspense>
  );
}

async function WorkerProfileContent() {
  const session = await getSessionUser();
  if (!session) redirect("/worker/login");
  if (session.role !== "worker") redirect("/employer");

  const db = adminDb();
  const [profile, skills, media, requestsSnapshot, reviewsSnapshot] = await Promise.all([
    db.collection(COL.users).doc(session.uid).get(),
    db.collection(COL.skills).where("uid", "==", session.uid).get(),
    db.collection(COL.media).where("uid", "==", session.uid).get(),
    db.collection(COL.contactRequests).where("workerUid", "==", session.uid).get(),
    db.collection(COL.endorsements).where("workerUid", "==", session.uid).where("status", "==", "approved").get(),
  ]);
  if (!profile.exists) redirect("/worker/login");

  const displayName = (profile.get("displayName") as string) ?? "Your profile";
  const ratingAvg = (profile.get("ratingAvg") as number) ?? 0;
  const ratingCount = (profile.get("ratingCount") as number) ?? 0;
  const visibility = (profile.get("visibility") as string) ?? "private";
  const workSamples = media.docs.map((doc) => ({
    id: doc.id,
    url: doc.get("secureUrl") as string,
    caption: (doc.get("caption") as string) ?? "Work sample",
    type: doc.get("type") as string,
    status: doc.get("moderationStatus") as string,
  }));
  const serviceRequests = requestsSnapshot.docs
    .filter((doc) => doc.get("requestType") === "service")
    .sort((a, b) => (b.get("createdAt")?.toMillis?.() ?? 0) - (a.get("createdAt")?.toMillis?.() ?? 0))
    .slice(0, 20)
    .map((doc) => ({
      id: doc.id,
      title: doc.get("serviceTitle") as string,
      details: (doc.get("details") as string) ?? "",
      status: doc.get("status") as string,
    }));
  const reviews = reviewsSnapshot.docs
    .sort((a, b) => (b.get("createdAt")?.toMillis?.() ?? 0) - (a.get("createdAt")?.toMillis?.() ?? 0))
    .slice(0, 20)
    .map((doc) => ({
      id: doc.id,
      name: (doc.get("voucherName") as string) ?? "Community member",
      relationship: (doc.get("voucherRelationship") as string) ?? "community member",
      rating: (doc.get("rating") as number) ?? 0,
      comment: (doc.get("comment") as string) ?? "",
      skillSlug: doc.get("skillSlug") as string | undefined,
    }));

  return (
    <Container component="main" maxWidth="lg" sx={{ py: { xs: 3, sm: 5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
          KasiTalent
        </Typography>
        <SignOutButton />
      </Stack>

      <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <Avatar sx={{ width: 64, height: 64, fontSize: 26, bgcolor: "primary.main" }}>
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography component="h1" variant="h4" fontWeight={800}>{displayName}</Typography>
            <Typography color="text.secondary">
              {[profile.get("township"), profile.get("city")].filter(Boolean).join(", ") || "Add your area on WhatsApp"}
            </Typography>
          </Box>
          <Chip label={visibility === "visible" ? "Visible to employers" : "Private profile"} color={visibility === "visible" ? "success" : "default"} />
        </Stack>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="overline" color="text.secondary">Rating</Typography>
            <Typography variant="h5" fontWeight={700}>{ratingAvg.toFixed(1)} / 5</Typography>
            <Typography variant="body2" color="text.secondary">{ratingCount} community reviews</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="overline" color="text.secondary">Skills</Typography>
            <Typography variant="h5" fontWeight={700}>{skills.size}</Typography>
            <Typography variant="body2" color="text.secondary">Listed on your profile</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="overline" color="text.secondary">Work samples</Typography>
            <Typography variant="h5" fontWeight={700}>{workSamples.length}</Typography>
            <Typography variant="body2" color="text.secondary">Sent through WhatsApp</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Typography component="h2" variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Your skills</Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
          {skills.docs.map((doc) => (
            <Chip
              key={doc.id}
              label={`${doc.get("label")} · ${doc.get("verificationStatus") === "pending" ? "not yet vouched" : "community vouched"}`}
              variant="outlined"
            />
          ))}
          {skills.empty && <Typography color="text.secondary">Add skills by messaging the KasiTalent WhatsApp number.</Typography>}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Ask someone who knows your work to message our WhatsApp number with <strong>VOUCH CODE</strong>. For a specific skill, send <strong>CODE skill name</strong> first, then share that code.
        </Typography>

        <Typography component="h2" variant="h6" fontWeight={700} sx={{ mt: 4, mb: 1.5 }}>Community reviews</Typography>
        {reviews.length === 0 ? (
          <Typography color="text.secondary">Reviews from customers, employers and community members will appear here.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {reviews.map((review) => (
              <Paper key={review.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography fontWeight={700}>{review.name} · {review.relationship}</Typography>
                    {review.comment && <Typography variant="body2" color="text.secondary">{review.comment}</Typography>}
                    {review.skillSlug && <Typography variant="caption" color="text.secondary">Skill: {review.skillSlug.replace(/_/g, " ")}</Typography>}
                  </Box>
                  <Rating value={review.rating} readOnly size="small" />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        <Typography component="h2" variant="h6" fontWeight={700} sx={{ mt: 4, mb: 1.5 }}>Your work samples</Typography>
        {workSamples.length === 0 ? (
          <Typography color="text.secondary">Send a photo or short video to KasiTalent on WhatsApp to add your first sample.</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5 }}>
            {workSamples.map((sample) => (
              <Box key={sample.id}>
                {sample.type === "video" ? (
                  <Box component="video" src={sample.url} controls sx={{ width: "100%", aspectRatio: "1", objectFit: "cover", bgcolor: "common.black" }} />
                ) : (
                  <Box component="img" src={sample.url} alt={sample.caption} sx={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
                )}
                <Typography variant="caption" display="block" noWrap>{sample.caption || "Work sample"}</Typography>
                {sample.status !== "approved" && <Chip size="small" label="Under review" />}
              </Box>
            ))}
          </Box>
        )}

        <Typography component="h2" variant="h6" fontWeight={700} sx={{ mt: 4, mb: 1.5 }}>Service requests</Typography>
        {serviceRequests.length === 0 ? (
          <Typography color="text.secondary">New service requests from employers will appear here.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {serviceRequests.map((request) => (
              <Paper key={request.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
                  <Box>
                    <Typography fontWeight={700}>{request.title}</Typography>
                    {request.details && <Typography variant="body2" color="text.secondary">{request.details}</Typography>}
                  </Box>
                  <Chip
                    label={request.status === "accepted" ? "Accepted" : request.status === "declined" ? "Declined" : "Waiting for your reply on WhatsApp"}
                    color={request.status === "accepted" ? "success" : "default"}
                    size="small"
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>
    </Container>
  );
}