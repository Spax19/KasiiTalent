import { redirect } from "next/navigation";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import StarIcon from "@mui/icons-material/Star";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ColorModeToggle from "@/components/ColorModeToggle";
import SignOutButton from "@/components/auth/SignOutButton";
import WorkerSidebar from "@/components/worker/WorkerSidebar";
import WorkerPortfolioManager from "@/components/worker/WorkerPortfolioManager";
import { adminDb, COL } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Worker dashboard · KasiTalent" };

function commandLink(number: string | undefined, command: string) {
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(command)}` : undefined;
}

function formatDate(timestamp: { toDate?: () => Date } | undefined): string {
  return timestamp?.toDate
    ? timestamp.toDate().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
    : "";
}

export default async function WorkerDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/worker/login");
  if (user.role === "employer") redirect("/dashboard");
  if (user.role !== "worker") redirect("/worker/login");

  const db = adminDb();
  const profileRef = db.collection(COL.users).doc(user.uid);
  const [profileSnap, skillSnap, mediaSnap, endorsementSnap, requestSnap] = await Promise.all([
    profileRef.get(),
    db.collection(COL.skills).where("uid", "==", user.uid).get(),
    db.collection(COL.media).where("uid", "==", user.uid).get(),
    db.collection(COL.endorsements).where("workerUid", "==", user.uid).get(),
    db.collection(COL.contactRequests).where("workerUid", "==", user.uid).limit(10).get(),
  ]);
  if (!profileSnap.exists || profileSnap.get("role") !== "worker") redirect("/worker/login");

  const profile = profileSnap.data()!;
  const skills = skillSnap.docs.map((doc) => ({
    slug: String(doc.get("skillSlug")),
    label: String(doc.get("label")),
    status: String(doc.get("verificationStatus")) as "pending" | "community_vouched" | "app_tested",
    yearsExperience: Number(doc.get("yearsExperience") ?? 0),
  }));
  const media = mediaSnap.docs
    .sort((a, b) => {
      const aCreated = a.get("createdAt") as { toMillis?: () => number } | undefined;
      const bCreated = b.get("createdAt") as { toMillis?: () => number } | undefined;
      return (bCreated?.toMillis?.() ?? 0) - (aCreated?.toMillis?.() ?? 0);
    })
    .map((doc) => ({
      id: doc.id,
      type: doc.get("type") === "video" ? "video" as const : "image" as const,
      thumbnailUrl: String(doc.get("thumbnailUrl") ?? ""),
      caption: String(doc.get("caption") ?? ""),
      moderationStatus: String(doc.get("moderationStatus")) as "approved" | "pending" | "rejected",
    }));
  const requests = requestSnap.docs
    .map((doc) => ({
      id: doc.id,
      status: String(doc.get("status") ?? "sent"),
      createdAt: doc.get("createdAt") as { toMillis?: () => number; toDate?: () => Date } | undefined,
    }))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  const visibility = String(profile.visibility ?? "private");
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const vouchLink = commandLink(whatsappNumber, "CODE");
  const photoLink = commandLink(whatsappNumber, "NEW PHOTO");
  const visibilityLink = commandLink(whatsappNumber, visibility === "visible" ? "PAUSE" : "RESUME");
  const visibleSkills = skills.filter((skill) => skill.status !== "pending").length;
  const totalVouches = Number(
    profile.endorsementCount ?? endorsementSnap.docs.filter((doc) => doc.get("status") === "approved").length,
  );
  const rating = Number(profile.ratingAvg ?? 0);

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <WorkerSidebar active="dashboard" />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
      <Box component="header" sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
        <Container maxWidth="xl" sx={{ py: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Box>
            <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
              KasiTalent
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>WORKER DASHBOARD</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button component="a" href="/worker/jobs" size="small">Find jobs</Button>
            <ColorModeToggle />
            <SignOutButton redirectTo="/worker/login" />
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
        <Typography variant="h4" component="h1" fontWeight={800}>Your work, your way</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
          Manage your public profile, share work samples, and keep track of local opportunities.
        </Typography>

        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems={{ md: "center" }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 24, fontWeight: 700 }}>
                {String(profile.displayName ?? "W").charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={800}>{String(profile.displayName ?? "Worker")}</Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                  <LocationOnIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {[profile.township, profile.city].filter(Boolean).join(", ") || "Location not set"}
                  </Typography>
                </Stack>
                {profile.bio && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{String(profile.bio)}</Typography>}
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip
                  icon={<VisibilityIcon />}
                  label={visibility === "visible" ? "Visible to employers" : visibility === "paused" ? "Profile paused" : "Private profile"}
                  color={visibility === "visible" ? "success" : "default"}
                  variant={visibility === "visible" ? "filled" : "outlined"}
                />
                {visibilityLink && (
                  <Button component="a" href={visibilityLink} target="_blank" rel="noreferrer" variant="outlined" size="small">
                    {visibility === "visible" ? "Pause profile" : "Make profile visible"}
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, mb: 4 }}>
          {[
            { label: "Skills", value: skills.length, icon: <CheckCircleOutlineIcon color="primary" />, detail: `${visibleSkills} verified` },
            { label: "Work samples", value: media.length, icon: <AddAPhotoIcon color="primary" />, detail: `${media.filter((item) => item.moderationStatus === "approved").length} approved` },
            { label: "Community vouches", value: totalVouches, icon: <StarIcon color="primary" />, detail: rating ? `${rating.toFixed(1)} average rating` : "Keep building trust" },
            { label: "Contact requests", value: requests.length, icon: <VisibilityIcon color="primary" />, detail: `${requests.filter((request) => request.status === "sent").length} awaiting your reply` },
          ].map((stat) => (
            <Card key={stat.label} variant="outlined">
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                  {stat.icon}
                </Stack>
                <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.detail}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Box id="skills" sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.7fr) minmax(280px, 0.8fr)" } }}>
          <Box>
            <Typography variant="h5" component="h2" fontWeight={800} sx={{ mb: 1.5 }}>Your skills</Typography>
            {skills.length === 0 ? (
              <Card variant="outlined"><CardContent><Typography color="text.secondary">Add your skills by messaging KasiTalent on WhatsApp.</Typography></CardContent></Card>
            ) : (
              <Stack spacing={1.5}>
                {skills.map((skill) => (
                  <Card key={skill.slug} variant="outlined">
                    <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={700}>{skill.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {skill.yearsExperience ? `${skill.yearsExperience} years experience` : "Experience not listed"}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={skill.status === "app_tested" ? "Skill tested" : skill.status === "community_vouched" ? "Community vouched" : "Not yet verified"}
                        color={skill.status === "app_tested" ? "success" : skill.status === "community_vouched" ? "info" : "default"}
                        variant={skill.status === "pending" ? "outlined" : "filled"}
                      />
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}

            <Box id="portfolio" sx={{ mt: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="h5" component="h2" fontWeight={800}>Your portfolio</Typography>
                {photoLink && (
                  <Button component="a" href={photoLink} target="_blank" rel="noreferrer" size="small" startIcon={<AddAPhotoIcon />}>
                    Add through WhatsApp
                  </Button>
                )}
              </Stack>
              <WorkerPortfolioManager
                skills={skills.map(({ slug, label }) => ({ slug, label }))}
                media={media}
                remainingUploads={Math.max(0, 12 - Number(profile.mediaCount ?? media.length))}
              />
            </Box>
          </Box>

          <Stack spacing={3}>
            <Card variant="outlined" id="requests">
              <CardContent>
                <Typography variant="h6" component="h2" fontWeight={800}>Contact requests</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Requests are handled privately through WhatsApp. Your number is shared only after you agree.
                </Typography>
                <Divider sx={{ my: 2 }} />
                {requests.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No contact requests yet.</Typography>
                ) : (
                  <Stack spacing={1.5}>
                    {requests.map((request) => (
                      <Box key={request.id}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2">{request.status === "sent" ? "Waiting for your reply" : request.status[0].toUpperCase() + request.status.slice(1)}</Typography>
                          <Typography variant="caption" color="text.secondary">{formatDate(request.createdAt)}</Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
                {whatsappNumber && (
                  <Button component="a" href={commandLink(whatsappNumber, "HELP")} target="_blank" rel="noreferrer" variant="contained" fullWidth sx={{ mt: 2 }}>
                    Reply on WhatsApp
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" component="h2" fontWeight={800}>Grow your profile</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  Ask a customer or employer to vouch for your work. They can message KasiTalent with your personal vouch code.
                </Typography>
                {vouchLink ? (
                  <Button component="a" href={vouchLink} target="_blank" rel="noreferrer" variant="outlined" fullWidth sx={{ mt: 2 }}>
                    Get my vouch code
                  </Button>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                    WhatsApp profile actions are available when KasiTalent&apos;s WhatsApp number is configured.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Container>
      </Box>
    </Box>
  );
}
