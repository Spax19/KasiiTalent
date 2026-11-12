"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import { createJobPosting, updateJobPosting, updateJobStatus } from "@/app/actions/jobs";
import type { JobPostingDTO } from "@/types";

function applicationDate(date: string) {
  return new Date(date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

function paymentLabel(type: JobPostingDTO["paymentType"]) {
  return type === "hourly" ? "per hour" : type === "daily" ? "per day" : "fixed";
}

function JobPostingForm({
  job,
  formId,
  submitLabel,
  busy,
  onSubmit,
}: {
  job?: JobPostingDTO;
  formId?: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Box
      component="form"
      id={formId}
      onSubmit={onSubmit}
      sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" } }}
    >
      <TextField name="title" label="Job title" placeholder="e.g. Experienced plumber" required inputProps={{ maxLength: 100 }} defaultValue={job?.title ?? ""} />
      <TextField name="township" label="Township or area" required inputProps={{ maxLength: 60 }} defaultValue={job?.township ?? ""} />
      <TextField
        name="description"
        label="What needs to be done?"
        multiline
        minRows={3}
        required
        inputProps={{ maxLength: 2000 }}
        defaultValue={job?.description ?? ""}
        sx={{ gridColumn: { md: "1 / -1" } }}
      />
      <TextField
        name="skills"
        label="Skills (comma separated)"
        placeholder="Plumbing, pipe fitting"
        inputProps={{ maxLength: 300 }}
        defaultValue={job?.skillSlugs.map((skill) => skill.replace(/_/g, " ")).join(", ") ?? ""}
      />
      <TextField
        name="startDate"
        label="Expected start date"
        type="date"
        InputLabelProps={{ shrink: true }}
        defaultValue={job?.startDate?.slice(0, 10) ?? ""}
      />
      <TextField name="paymentType" label="Pay type" select defaultValue={job?.paymentType ?? "fixed"}>
        <MenuItem value="fixed">Fixed amount</MenuItem>
        <MenuItem value="hourly">Per hour</MenuItem>
        <MenuItem value="daily">Per day</MenuItem>
      </TextField>
      <TextField name="payAmountZar" label="Pay amount (ZAR)" type="number" required inputProps={{ min: 1, step: 0.01 }} defaultValue={job?.payAmountZar ?? ""} />
      <TextField name="radiusKm" label="Worker travel radius (km)" type="number" required inputProps={{ min: 1, max: 100, step: 1 }} defaultValue={job?.radiusKm ?? 25} />
      <Box sx={{ gridColumn: { md: "1 / -1" } }}>
        <Button type="submit" variant="contained" size="large" disabled={busy}>{submitLabel}</Button>
      </Box>
    </Box>
  );
}

export default function JobsManager({
  jobs,
}: {
  jobs: JobPostingDTO[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingJob, setEditingJob] = useState<JobPostingDTO | null>(null);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await createJobPosting(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        form.reset();
        setSuccess("Your job is live and ready to receive applications.");
        router.refresh();
      } catch {
        setError("Your job could not be published. Please try again.");
      }
    });
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingJob) return;
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const jobId = editingJob.id;
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await updateJobPosting(jobId, payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setEditingJob(null);
        setSuccess("Your job post has been updated.");
        router.refresh();
      } catch {
        setError("Your job could not be updated. Please try again.");
      }
    });
  }

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>, message: string) {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error ?? "That update could not be saved.");
          return;
        }
        setSuccess(message);
        router.refresh();
      } catch {
        setError("That update could not be saved. Please try again.");
      }
    });
  }

  return (
    <Stack spacing={4}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h5" component="h2" fontWeight={800}>Post a job</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            Add as many openings as you need. Each post stays open for 30 days unless you close or fill it.
          </Typography>
          <JobPostingForm submitLabel="Publish job" busy={busy} onSubmit={handleCreate} />
        </CardContent>
      </Card>

      <Box>
        <Typography variant="h5" component="h2" fontWeight={800} sx={{ mb: 1.5 }}>Your job posts</Typography>
        {jobs.length === 0 ? (
          <Card variant="outlined"><CardContent><Typography color="text.secondary">You have not posted a job yet. Your openings will appear here.</Typography></CardContent></Card>
        ) : (
          <Stack spacing={1.5}>
            {jobs.map((job) => (
              <Card key={job.id} variant="outlined">
                <CardContent>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" fontWeight={800}>{job.title}</Typography>
                        <Chip size="small" label={job.status} color={job.status === "open" ? "success" : "default"} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {job.township} · R{job.payAmountZar.toLocaleString("en-ZA")} {paymentLabel(job.paymentType)} · {job.applicantCount} {job.applicantCount === 1 ? "response" : "responses"}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{job.description}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Posted {applicationDate(job.createdAt)} · Expires {applicationDate(job.expiresAt)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="flex-start">
                      <Tooltip title="Edit job">
                        <span>
                          <IconButton aria-label="Edit job" size="small" disabled={busy} onClick={() => setEditingJob(job)}>
                            <EditOutlinedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {job.status !== "expired" && job.status !== "open" && (
                        <Tooltip title="Reopen job">
                          <span>
                            <IconButton aria-label="Reopen job" size="small" disabled={busy} onClick={() => runAction(() => updateJobStatus(job.id, "open"), "Job reopened.")}>
                              <ReplayIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {job.status !== "expired" && job.status !== "filled" && (
                        <Tooltip title="Mark job as filled">
                          <span>
                            <IconButton aria-label="Mark job as filled" size="small" disabled={busy} onClick={() => runAction(() => updateJobStatus(job.id, "filled"), "Job marked as filled.")}>
                              <CheckCircleOutlineIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {job.status !== "expired" && job.status !== "closed" && (
                        <Tooltip title="Close job">
                          <span>
                            <IconButton aria-label="Close job" size="small" color="error" disabled={busy} onClick={() => runAction(() => updateJobStatus(job.id, "closed"), "Job closed.")}>
                              <CloseIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>

      <Dialog
        open={Boolean(editingJob)}
        onClose={() => {
          if (!busy) setEditingJob(null);
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Edit job posting</DialogTitle>
        <DialogContent>
          {editingJob && (
            <JobPostingForm
              key={editingJob.id}
              job={editingJob}
              formId="edit-job-form"
              submitLabel="Save changes"
              busy={busy}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setEditingJob(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>

    </Stack>
  );
}
