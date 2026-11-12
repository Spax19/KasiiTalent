// Path: src/app/(employer)/dashboard/page.tsx
// Server Component: queries Firestore (Admin SDK), builds browser-safe DTOs, renders the grid.
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Badge from "@mui/material/Badge";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupIcon from "@mui/icons-material/Group";
import WorkIcon from "@mui/icons-material/Work";
import MessageIcon from "@mui/icons-material/Message";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import AddCircleIcon from "@mui/icons-material/AddCircle";

import { adminDb, COL } from "@/lib/firebase/admin";
import { getSessionUser, requireUser } from "@/lib/auth";
import { notifyContactRequest } from "@/services/contact";
import CandidateGrid from "@/components/employer/CandidateGrid";
import ColorModeToggle from "@/components/ColorModeToggle";
import SignOutButton from "@/components/auth/SignOutButton";
import type { CandidateDTO } from "@/types";

export const dynamic = "force-dynamic";

async function loadCandidates(townshipSlug?: string): Promise<CandidateDTO[]> {
  const db = adminDb();

  let q = db
    .collection(COL.users)
    .where("role", "==", "worker")
    .where("visibility", "==", "visible"); // only workers who consented to sharing
  if (townshipSlug) q = q.where("townshipSlug", "==", townshipSlug);
  const users = await q.orderBy("ratingAvg", "desc").limit(30).get();

  if (users.empty) return [];
  const ids = users.docs.map((d) => d.id);

  const [skillsSnap, mediaSnap] = await Promise.all([
    db.collection(COL.skills).where("uid", "in", ids).get(),
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
  await notifyContactRequest(ref.id);
}

const TRADES = ["All Trades", "Plumber", "Electrician", "Tiler", "Carpenter", "Painter", "Builder", "Gardener", "Mechanic"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ township?: string; trade?: string; q?: string; sort?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.role === "worker") redirect("/worker/dashboard");
  if (user.role !== "employer") redirect("/login?next=/dashboard");

  const resolvedParams = await searchParams;
  const township = resolvedParams.township;
  const candidates = await loadCandidates(township);
  const employerProfile = await adminDb().collection(COL.users).doc(user.uid).get();
  const employerName = employerProfile.get("businessName") || employerProfile.get("displayName") || "Employer";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      {/* Sidebar Navigation */}
      <Box
        component="nav"
        sx={{
          width: 260,
          flexShrink: 0,
          bgcolor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          p: 2,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={800} color="primary" sx={{ px: 2, py: 1, textDecoration: "none", display: "block" }} component="a" href="/">
            KasiTalent
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: "block", mb: 3 }}>
            REAL SKILLS. STRONGER COMMUNITIES.
          </Typography>

          <List component="div" sx={{ p: 0 }}>
            <ListItemButton component="a" href="/dashboard" sx={{ borderRadius: 2, mb: 1, color: "text.secondary" }}>
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}><DashboardIcon /></ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
            <ListItemButton component="a" href="/dashboard?tab=find" selected sx={{ borderRadius: 2, mb: 1, bgcolor: "action.selected", color: "primary.main" }}>
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}><GroupIcon /></ListItemIcon>
              <ListItemText primary="Find Talent" />
            </ListItemButton>
            <ListItemButton component="a" href="/jobs" sx={{ borderRadius: 2, mb: 1, color: "text.secondary" }}>
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}><WorkIcon /></ListItemIcon>
              <ListItemText primary="My Jobs" />
            </ListItemButton>
            <ListItemButton component="a" href="/messages" sx={{ borderRadius: 2, mb: 1, color: "text.secondary" }}>
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>
                <Badge badgeContent={3} color="error"><MessageIcon /></Badge>
              </ListItemIcon>
              <ListItemText primary="Messages" />
            </ListItemButton>
            <ListItemButton component="a" href="/saved" sx={{ borderRadius: 2, mb: 1, color: "text.secondary" }}>
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}><FavoriteIcon /></ListItemIcon>
              <ListItemText primary="Saved Candidates" />
            </ListItemButton>
            <ListItemButton component="a" href="/settings" sx={{ borderRadius: 2, mb: 1, color: "text.secondary" }}>
              <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}><SettingsIcon /></ListItemIcon>
              <ListItemText primary="Account Settings" />
            </ListItemButton>
          </List>
        </Box>

        {/* Callout box inside sidebar */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: "action.hover", borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1, color: "primary.main" }}>
            <GroupIcon />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Hire local. Build brighter communities.
          </Typography>
          <Button variant="contained" fullWidth sx={{ mt: 2 }}>
            Post a Job
          </Button>
        </Paper>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
        {/* Top Header Bar */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", px: { xs: 2, md: 4 }, py: 2, borderBottom: 1, borderColor: "divider", gap: { xs: 1, md: 3 } }}>
          <Typography component="a" href="/dashboard" sx={{ display: { xs: "none", lg: "block" }, color: "text.secondary", textDecoration: "none", fontWeight: 500 }}>Dashboard</Typography>
          <Typography component="a" href="/dashboard" sx={{ display: { xs: "none", lg: "block" }, color: "primary.main", textDecoration: "none", fontWeight: 700, borderBottom: 2, borderColor: "primary.main", pb: 0.5 }}>Find Talent</Typography>
          <Typography component="a" href="/jobs" sx={{ display: { xs: "none", lg: "block" }, color: "text.secondary", textDecoration: "none", fontWeight: 500 }}>My Jobs</Typography>
          <Typography component="a" href="/messages" sx={{ display: { xs: "none", lg: "block" }, color: "text.secondary", textDecoration: "none", fontWeight: 500 }}>Messages</Typography>
          <Typography component="a" href="/saved" sx={{ display: { xs: "none", lg: "block" }, color: "text.secondary", textDecoration: "none", fontWeight: 500 }}>Saved</Typography>

          <ColorModeToggle />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: { xs: 0, md: 1 }, pl: { xs: 0, md: 2 }, borderLeft: { xs: 0, md: 1 }, borderColor: "divider" }}>
            <Avatar sx={{ bgcolor: "primary.main", color: "primary.contrastText", width: 36, height: 36, fontSize: "0.9rem", fontWeight: 700 }}>
              {String(employerName).split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </Avatar>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2" fontWeight={700} lineHeight={1.2}>{employerName}</Typography>
              <Typography variant="caption" color="text.secondary">Employer</Typography>
            </Box>
          </Box>
          <SignOutButton />
        </Box>

        {/* Page Content */}
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Typography variant="h4" component="h1" fontWeight={800} sx={{ mb: 1 }}>
            Find Skilled Talent Near You
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Discover reliable, verified professionals in your area.
          </Typography>

          {/* Search & Location Bar */}
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: { xs: "wrap", md: "nowrap" } }}>
            <TextField
              fullWidth
              placeholder="Find talent in your area"
              defaultValue={resolvedParams.q ?? ""}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
                sx: { bgcolor: "background.paper", borderRadius: 2, color: "text.primary", "& fieldset": { borderColor: "divider" } }
              }}
            />
            <TextField
              defaultValue="Johannesburg"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LocationOnIcon sx={{ color: "text.secondary" }} />
                  </InputAdornment>
                ),
                sx: { bgcolor: "background.paper", borderRadius: 2, color: "text.primary", minWidth: 200, "& fieldset": { borderColor: "divider" } }
              }}
              select
            >
              <MenuItem value="Johannesburg">Johannesburg</MenuItem>
              <MenuItem value="Soweto">Soweto</MenuItem>
              <MenuItem value="Midrand">Midrand</MenuItem>
            </TextField>
            <Button
              variant="contained"
              size="large"
              sx={{ px: 4, fontWeight: 700 }}
            >
              Search
            </Button>
          </Box>

          {/* Trade Filter Chips & More Filters */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
            <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 1, maxWidth: "100%" }}>
              {TRADES.map((trade, idx) => (
                <Chip
                  key={trade}
                  label={trade}
                  clickable
                  sx={{
                    bgcolor: idx === 0 ? "primary.main" : "background.paper",
                    color: idx === 0 ? "primary.contrastText" : "text.primary",
                    fontWeight: idx === 0 ? 700 : 400,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: idx === 0 ? "primary.main" : "divider",
                    "&:hover": { bgcolor: idx === 0 ? "primary.dark" : "action.hover" }
                  }}
                />
              ))}
            </Stack>

            <Button
              variant="outlined"
              startIcon={<TuneIcon />}
              sx={{ color: "text.primary", borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}
            >
              More Filters
            </Button>
          </Box>

          {/* Results Count & Sorting */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
            <Typography variant="body1" fontWeight={700}>
              {candidates.length} talented professionals found
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Sort by</Typography>
              <Select
                defaultValue="Most Relevant"
                size="small"
                sx={{ bgcolor: "background.paper", color: "text.primary", borderRadius: 2, "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" } }}
              >
                <MenuItem value="Most Relevant">Most Relevant</MenuItem>
                <MenuItem value="Highest Rated">Highest Rated</MenuItem>
                <MenuItem value="Newest">Newest</MenuItem>
              </Select>
            </Box>
          </Box>

          {/* Candidate Grid */}
          <CandidateGrid candidates={candidates} onRequestContact={requestContact} />
        </Container>
      </Box>
    </Box>
  );
}