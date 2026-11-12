"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { updateEmployerProfile } from "@/app/actions/employer";

export default function EmployerSettingsForm({
  businessName,
  businessType,
  township,
  city,
  province,
  email,
}: {
  businessName: string;
  businessType: string;
  township: string;
  city: string;
  province: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    setError("");
    setSuccess("");

    startTransition(async () => {
      try {
        const result = await updateEmployerProfile(payload);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSuccess("Your business settings have been saved.");
        router.refresh();
      } catch {
        setError("Your business settings could not be saved. Please try again.");
      }
    });
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" component="h2" fontWeight={800}>Business profile</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
            Keep your business name and area up to date for workers and job listings.
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" } }}>
            <TextField name="businessName" label="Business name" required inputProps={{ maxLength: 80 }} defaultValue={businessName} />
            <TextField name="businessType" label="Type of business" inputProps={{ maxLength: 80 }} defaultValue={businessType} />
            <TextField name="township" label="Township or area" required inputProps={{ maxLength: 60 }} defaultValue={township} />
            <TextField name="city" label="City" inputProps={{ maxLength: 60 }} defaultValue={city} />
            <TextField name="province" label="Province" inputProps={{ maxLength: 60 }} defaultValue={province} />
            <Box sx={{ gridColumn: { md: "1 / -1" } }}>
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? "Saving…" : "Save business profile"}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h2" fontWeight={800}>Sign-in account</Typography>
          <TextField
            label="Email address"
            value={email}
            fullWidth
            disabled
            helperText="Manage your email and password with the sign-in provider for this account."
            sx={{ mt: 2 }}
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
