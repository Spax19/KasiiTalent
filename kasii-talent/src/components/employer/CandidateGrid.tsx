// Path: src/components/employer/CandidateGrid.tsx
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SearchIcon from "@mui/icons-material/Search";
import VerifiedIcon from "@mui/icons-material/Verified";
import type { CandidateDTO, CandidateMediaDTO, VerificationStatus } from "@/types";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */
interface CandidateGridProps {
  candidates: CandidateDTO[];
  /** Calls a Server Action that creates a consent-gated contact request. */
  onRequestContact?: (candidateId: string) => Promise<void> | void;
}

/* ------------------------------------------------------------------ */
/* Verification badge                                                  */
/* ------------------------------------------------------------------ */
const STATUS: Record<VerificationStatus, { label: string; color: "success" | "info" | "default" }> = {
  app_tested: { label: "Skill tested", color: "success" },
  community_vouched: { label: "Community vouched", color: "info" },
  pending: { label: "Unverified", color: "default" },
};

function VerifiedBadge({ status }: { status: VerificationStatus }) {
  const s = STATUS[status];
  return (
    <Chip
      size="small"
      label={s.label}
      color={s.color}
      variant={status === "pending" ? "outlined" : "filled"}
      icon={status === "pending" ? undefined : <VerifiedIcon />}
      sx={{ flexShrink: 0 }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Media strip (horizontal scroll of thumbnails)                       */
/* ------------------------------------------------------------------ */
function MediaStrip({ media, onOpen }: { media: CandidateMediaDTO[]; onOpen: (index: number) => void }) {
  if (media.length === 0) {
    return (
      <Box
        sx={{
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 2,
          bgcolor: "action.hover",
          color: "text.disabled",
        }}
      >
        <Typography variant="caption">No work photos yet</Typography>
      </Box>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ overflowX: "auto", pb: 0.5, scrollSnapType: "x mandatory", mx: -0.5, px: 0.5 }}
    >
      {media.map((m, i) => (
        <Box
          key={m.id}
          component="button"
          type="button"
          onClick={() => onOpen(i)}
          aria-label={`View ${m.type}: ${m.caption || m.skillSlug.replace(/_/g, " ")}`}
          sx={{
            position: "relative",
            flexShrink: 0,
            width: 96,
            height: 96,
            p: 0,
            border: 0,
            borderRadius: 2,
            overflow: "hidden",
            cursor: "pointer",
            bgcolor: "action.hover",
            scrollSnapAlign: "start",
            "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.thumbnailUrl}
            alt={m.caption || "Work sample"}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {m.type === "video" && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.3)",
                color: "common.white",
              }}
            >
              <PlayArrowIcon fontSize="large" />
            </Box>
          )}
        </Box>
      ))}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/* Lightbox                                                            */
/* ------------------------------------------------------------------ */
function Lightbox({
  media,
  startIndex,
  onClose,
}: {
  media: CandidateMediaDTO[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const current = media[index];

  const prev = useCallback(() => setIndex((i) => (i - 1 + media.length) % media.length), [media.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % media.length), [media.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-label="Work sample">
      <IconButton
        aria-label="Close"
        onClick={onClose}
        sx={{ position: "absolute", top: 8, right: 8, zIndex: 2, bgcolor: "background.paper", "&:hover": { bgcolor: "grey.200" } }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ p: 0, bgcolor: "common.black", position: "relative" }}>
        {current.type === "video" ? (
          <video
            key={current.id}
            src={current.url}
            controls
            autoPlay
            playsInline
            style={{ width: "100%", maxHeight: "75vh", display: "block" }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.caption || "Work sample"}
            style={{ width: "100%", maxHeight: "75vh", objectFit: "contain", display: "block" }}
          />
        )}
        {media.length > 1 && (
          <>
            <IconButton
              aria-label="Previous"
              onClick={prev}
              sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "common.white" } }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              aria-label="Next"
              onClick={next}
              sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.9)", "&:hover": { bgcolor: "common.white" } }}
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}
      </DialogContent>
      <Box sx={{ px: 2, py: 1.5, textAlign: "center" }}>
        <Typography variant="body2">
          {current.caption || current.skillSlug.replace(/_/g, " ")}
          <Typography component="span" variant="body2" color="text.disabled" sx={{ ml: 1 }}>
            {index + 1}/{media.length}
          </Typography>
        </Typography>
      </Box>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Candidate card                                                      */
/* ------------------------------------------------------------------ */
function CandidateCard({
  candidate,
  onRequestContact,
}: {
  candidate: CandidateDTO;
  onRequestContact?: CandidateGridProps["onRequestContact"];
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const bestStatus = useMemo<VerificationStatus>(() => {
    if (candidate.skills.some((s) => s.status === "app_tested")) return "app_tested";
    if (candidate.skills.some((s) => s.status === "community_vouched")) return "community_vouched";
    return "pending";
  }, [candidate.skills]);

  async function handleRequest() {
    if (!onRequestContact || sent || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await onRequestContact(candidate.id);
      setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="outlined" sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Avatar sx={{ bgcolor: "primary.light", color: "primary.contrastText", width: 48, height: 48, fontWeight: 700 }}>
            {candidate.displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {candidate.displayName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {candidate.township}
              {candidate.distanceKm != null && ` · ${candidate.distanceKm.toFixed(1)} km away`}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
              <Rating
                value={candidate.ratingAvg}
                precision={0.5}
                readOnly
                size="small"
                aria-label={`Rated ${candidate.ratingAvg.toFixed(1)} out of 5 from ${candidate.ratingCount} reviews`}
              />
              <Typography variant="caption" color="text.secondary">
                {candidate.ratingCount > 0
                  ? `${candidate.ratingAvg.toFixed(1)} (${candidate.ratingCount})`
                  : "No reviews yet"}
              </Typography>
            </Stack>
          </Box>
          <VerifiedBadge status={bestStatus} />
        </Stack>

        {candidate.bio && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {candidate.bio}
          </Typography>
        )}

        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.75}>
          {candidate.skills.map((s) => (
            <Chip
              key={s.slug}
              size="small"
              variant="outlined"
              label={s.yearsExperience > 0 ? `${s.label} · ${s.yearsExperience}y` : s.label}
              icon={s.status === "pending" ? undefined : <VerifiedIcon />}
              color={s.status === "app_tested" ? "success" : s.status === "community_vouched" ? "info" : "default"}
              title={STATUS[s.status].label}
            />
          ))}
        </Stack>

        <MediaStrip media={candidate.media} onOpen={setLightboxIndex} />
      </CardContent>

      <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 2, pt: 0 }}>
        <Typography variant="caption" color={failed ? "error" : "text.disabled"}>
          {failed ? "Could not send. Try again." : `${candidate.endorsementCount} community vouches`}
        </Typography>
        <Button
          variant="contained"
          color={sent ? "success" : "secondary"}
          size="small"
          onClick={handleRequest}
          disabled={sent || busy || !onRequestContact}
          sx={{ "&.Mui-disabled": sent ? { bgcolor: "success.main", color: "common.white" } : undefined }}
        >
          {sent ? "Request sent ✓" : busy ? "Sending…" : "Request contact"}
        </Button>
      </CardActions>

      {lightboxIndex !== null && (
        <Lightbox media={candidate.media} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Grid with lightweight client-side filters                           */
/* ------------------------------------------------------------------ */
export default function CandidateGrid({ candidates, onRequestContact }: CandidateGridProps) {
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (verifiedOnly && !c.skills.some((s) => s.status !== "pending")) return false;
      if (!q) return true;
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.township.toLowerCase().includes(q) ||
        c.skills.some((s) => s.label.toLowerCase().includes(q))
      );
    });
  }, [candidates, query, verifiedOnly]);

  return (
    <Container component="section" maxWidth="xl" sx={{ py: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between" sx={{ mb: 3 }}>
        <TextField
          type="search"
          size="small"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skill, name or township (e.g. welding, Tembisa)"
          sx={{ width: "100%", maxWidth: { sm: 440 }, bgcolor: "background.paper" }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { "aria-label": "Search candidates" },
          }}
        />
        <FormControlLabel
          control={<Checkbox checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />}
          label="Verified skills only"
        />
      </Stack>

      {filtered.length === 0 ? (
        <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 3, py: 8, textAlign: "center" }}>
          <Typography color="text.secondary">No candidates match yet. Try a wider area or remove filters.</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", xl: "repeat(3, 1fr)" },
          }}
        >
          {filtered.map((c) => (
            <CandidateCard key={c.id} candidate={c} onRequestContact={onRequestContact} />
          ))}
        </Box>
      )}
    </Container>
  );
}
