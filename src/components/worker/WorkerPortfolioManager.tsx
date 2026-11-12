"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { getUploadSignature, savePortfolioMedia } from "@/app/actions/worker";

interface WorkerSkill {
  slug: string;
  label: string;
}

interface PortfolioItem {
  id: string;
  type: "image" | "video";
  thumbnailUrl: string;
  caption: string;
  moderationStatus: "approved" | "pending" | "rejected";
}

interface WorkerPortfolioManagerProps {
  skills: WorkerSkill[];
  media: PortfolioItem[];
  remainingUploads: number;
}

interface CloudinaryUploadResponse {
  public_id?: unknown;
  secure_url?: unknown;
  width?: unknown;
  height?: unknown;
  bytes?: unknown;
  duration?: unknown;
  error?: { message?: unknown };
}

export default function WorkerPortfolioManager({
  skills,
  media,
  remainingUploads,
}: WorkerPortfolioManagerProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [skillSlug, setSkillSlug] = useState(skills[0]?.slug ?? "");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function upload() {
    if (!file || !skillSlug) {
      setError("Choose a skill and a photo or video to upload.");
      return;
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Choose an image or video file.");
      return;
    }
    if (file.size > 50_000_000) {
      setError("Files must be 50 MB or smaller.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const signature = await getUploadSignature(kind);
      const formData = new FormData();
      formData.set("file", file);
      formData.set("api_key", signature.apiKey);
      formData.set("timestamp", String(signature.timestamp));
      formData.set("folder", signature.folder);
      formData.set("transformation", signature.transformation);
      formData.set("signature", signature.signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/${signature.resourceType}/upload`,
        { method: "POST", body: formData },
      );
      const uploaded = (await response.json()) as CloudinaryUploadResponse;
      if (!response.ok) {
        const message = uploaded.error?.message;
        throw new Error(typeof message === "string" ? message : "The file could not be uploaded.");
      }
      if (typeof uploaded.public_id !== "string" || typeof uploaded.secure_url !== "string") {
        throw new Error("The upload service returned incomplete file details.");
      }

      const result = await savePortfolioMedia({
        publicId: uploaded.public_id,
        secureUrl: uploaded.secure_url,
        type: kind,
        skillSlug,
        caption: caption.trim(),
        ...(typeof uploaded.width === "number" ? { width: uploaded.width } : {}),
        ...(typeof uploaded.height === "number" ? { height: uploaded.height } : {}),
        ...(typeof uploaded.bytes === "number" ? { bytes: uploaded.bytes } : {}),
        ...(typeof uploaded.duration === "number" && uploaded.duration > 0
          ? { durationSec: uploaded.duration }
          : {}),
      });
      if (!result.ok) throw new Error(result.error);

      setFile(null);
      setCaption("");
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The work sample could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">Your work sample was saved for review.</Alert>}

      {skills.length > 0 && remainingUploads > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700}>Add a work sample</Typography>
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField
                select
                label="Skill"
                value={skillSlug}
                onChange={(event) => setSkillSlug(event.target.value)}
                fullWidth
              >
                {skills.map((skill) => (
                  <MenuItem key={skill.slug} value={skill.slug}>{skill.label}</MenuItem>
                ))}
              </TextField>
              <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={busy}>
                {file ? file.name : "Choose a photo or video"}
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </Button>
              <TextField
                label="Caption (optional)"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                inputProps={{ maxLength: 140 }}
                helperText={`${caption.length}/140`}
                fullWidth
              />
              <Button onClick={upload} variant="contained" disabled={busy || !file || !skillSlug}>
                {busy ? "Uploading…" : "Upload work sample"}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {remainingUploads} of 12 portfolio spaces available. New uploads are reviewed before employers can see them.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {skills.length === 0 && (
        <Alert severity="info">Add a skill through WhatsApp before attaching work samples.</Alert>
      )}
      {remainingUploads === 0 && (
        <Alert severity="info">Your portfolio has reached its 12-item limit.</Alert>
      )}

      {media.length === 0 ? (
        <Box sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Your portfolio is empty. Add a work photo or video to help local businesses see what you do.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" } }}>
          {media.map((item) => (
            <Card key={item.id} variant="outlined">
              <Box
                component="img"
                src={item.thumbnailUrl}
                alt={item.caption || "Portfolio work sample"}
                sx={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover", bgcolor: "action.hover" }}
              />
              <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Chip
                  size="small"
                  label={item.moderationStatus === "approved" ? "Approved" : item.moderationStatus === "pending" ? "In review" : "Not approved"}
                  color={item.moderationStatus === "approved" ? "success" : item.moderationStatus === "pending" ? "default" : "error"}
                  variant={item.moderationStatus === "pending" ? "outlined" : "filled"}
                />
                {item.caption && <Typography variant="body2" sx={{ mt: 1 }}>{item.caption}</Typography>}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Stack>
  );
}
