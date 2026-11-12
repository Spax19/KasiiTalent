// Path: src/app/(employer)/dashboard/page.tsx
// Server Component: queries Firestore (Admin SDK), builds browser-safe DTOs, renders the grid.
import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Avatar from "@mui/material/Avatar";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import TuneIcon from "@mui/icons-material/Tune";

import { adminDb, COL } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { loadCandidates } from "@/services/candidates";
import { requestContact, setSavedCandidate } from "@/app/actions/employer";
import CandidateGrid from "@/components/employer/CandidateGrid";
import EmployerSidebar from "@/components/employer/EmployerSidebar";
import ColorModeToggle from "@/components/ColorModeToggle";
import SignOutButton from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

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
  const db = adminDb();
  const [candidates, employerProfile, savedSnapshot] = await Promise.all([
    loadCandidates(township),
    db.collection(COL.users).doc(user.uid).get(),
    db.collection(COL.savedCandidates).where("employerUid", "==", user.uid).get(),
  ]);
  const savedCandidateIds = savedSnapshot.docs.map((doc) => String(doc.get("workerUid") ?? "")).filter(Boolean);
  const employerName = employerProfile.get("businessName") || employerProfile.get("displayName") || "Employer";

  return (
    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <EmployerSidebar active="talent" />
      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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
          <CandidateGrid
            candidates={candidates}
            onRequestContact={requestContact}
            savedCandidateIds={savedCandidateIds}
            onToggleSaved={setSavedCandidate}
          />
        </Container>
      </Box>
    </Box>
  );
}