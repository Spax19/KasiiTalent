"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { applyToJob } from "@/app/actions/jobs";
import type { JobPostingDTO, WorkerJobApplicationDTO } from "@/types";

function dateLabel(date: string) {
  return new Date(date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default function JobOpportunities({
  jobs,
  applications,
}: {
  jobs: JobPostingDTO[];
  applications: WorkerJobApplicationDTO[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function submitApplication(event: FormEvent<HTMLFormElement>, jobId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await applyToJob({ ...payload, jobId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        form.reset();
        setSuccess("Your application has been sent to the employer.");
        router.refresh();
      } catch {
        setError("Your application could not be submitted. Please try again.");
      }
    });
  }

  return (
    <Stack spacing={4}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Box>
        <Typography variant="h5" component="h2" fontWeight={800} sx={{ mb: 1.5 }}>Open jobs near you</Typography>
        {jobs.length === 0 ? (
          <Card variant="outlined"><CardContent><Typography color="text.secondary">There are no open jobs right now. Check back soon.</Typography></CardContent></Card>
        ) : (
          <Stack spacing={1.5}>
            {jobs.map((job) => {
              const application = applications.find((item) => item.id === job.id);
              return (
                <Card key={job.id} variant="outlined">
                  <CardContent>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight={800}>{job.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {job.employerName} · {job.township} · R{job.payAmountZar.toLocaleString("en-ZA")} {job.paymentType === "fixed" ? "fixed" : `per ${job.paymentType === "hourly" ? "hour" : "day"}`}
                        </Typography>
                        {job.skillSlugs.length > 0 && (
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                            {job.skillSlugs.map((skill) => <Chip key={skill} size="small" label={skill.replace(/_/g, " ")} />)}
                          </Stack>
                        )}
                        <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>{job.description}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          {job.startDate ? `Starts ${dateLabel(job.startDate)} · ` : ""}Within {job.radiusKm} km · Posted {dateLabel(job.createdAt)}
                        </Typography>
                      </Box>
                      {application ? (
                        <Chip label={`Application ${application.status}`} color={application.status === "accepted" ? "success" : "default"} />
                      ) : (
                        <Box component="form" onSubmit={(event) => submitApplication(event, job.id)} sx={{ minWidth: { sm: 240 }, display: "flex", flexDirection: "column", gap: 1 }}>
                          <TextField name="message" label="Message to employer (optional)" multiline minRows={2} inputProps={{ maxLength: 1000 }} />
                          <Button type="submit" variant="contained" disabled={busy}>Apply</Button>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="h5" component="h2" fontWeight={800} sx={{ mb: 1.5 }}>Your applications</Typography>
        {applications.length === 0 ? (
          <Card variant="outlined"><CardContent><Typography color="text.secondary">Jobs you apply for will appear here with their response status.</Typography></CardContent></Card>
        ) : (
          <Stack spacing={1}>
            {applications.map((application) => (
              <Card key={application.id} variant="outlined">
                <CardContent sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center" }}>
                  <Box>
                    <Typography fontWeight={700}>{application.jobTitle}</Typography>
                    <Typography variant="body2" color="text.secondary">{application.township} · Applied {dateLabel(application.createdAt)}</Typography>
                  </Box>
                  <Chip label={application.status} color={application.status === "accepted" ? "success" : "default"} />
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
