"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { respondToApplication } from "@/app/actions/jobs";
import type { EmployerJobApplicationDTO } from "@/types";

function applicationDate(date: string) {
  return new Date(date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export default function EmployerMessages({ applications }: { applications: EmployerJobApplicationDTO[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const groups = applications.reduce((result, application) => {
    let group = result.find((item) => item.jobId === application.jobId);
    if (!group) {
      group = { jobId: application.jobId, jobTitle: application.jobTitle, applications: [] };
      result.push(group);
    }
    group.applications.push(application);
    return result;
  }, [] as { jobId: string; jobTitle: string; applications: EmployerJobApplicationDTO[] }[]);

  function respond(application: EmployerJobApplicationDTO, status: "accepted" | "declined") {
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await respondToApplication(application.id, status);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess(`Application ${status}.`);
        router.refresh();
      } catch {
        setError("Your response could not be saved. Please try again.");
      }
    });
  }

  const pendingCount = applications.filter((application) => application.status === "pending").length;

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {applications.length} {applications.length === 1 ? "response" : "responses"}
        </Typography>
        <Chip size="small" label={`${pendingCount} to review`} color={pendingCount ? "primary" : "default"} />
      </Stack>

      {groups.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography fontWeight={700}>No worker responses yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Applications to your job posts will appear here, grouped by job.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.jobId} variant="outlined">
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="h6" component="h2" fontWeight={800}>{group.jobTitle}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {group.applications.length} {group.applications.length === 1 ? "application" : "applications"}
                  </Typography>
                </Box>
                <Button component="a" href="/jobs" size="small">Manage job</Button>
              </Stack>
              <Divider />
              <Stack divider={<Divider flexItem />} spacing={0}>
                {group.applications.map((application) => (
                  <Box key={application.id} sx={{ py: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography fontWeight={700}>{application.workerName}</Typography>
                          <Chip
                            size="small"
                            label={application.status}
                            color={application.status === "accepted" ? "success" : application.status === "pending" ? "warning" : "default"}
                          />
                        </Stack>
                        {application.workerTownship && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {application.workerTownship}
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
                          {application.message || "No message included."}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          Received {applicationDate(application.createdAt)}
                        </Typography>
                      </Box>
                      {application.status === "pending" && (
                        <Stack direction="row" spacing={1} alignItems="flex-start">
                          <Button variant="contained" size="small" disabled={busy} onClick={() => respond(application, "accepted")}>
                            Accept
                          </Button>
                          <Button color="inherit" size="small" disabled={busy} onClick={() => respond(application, "declined")}>
                            Decline
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))
      )}
    </Stack>
  );
}
