"use client";
import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import { applyActionCode } from "firebase/auth";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { friendlyAuthError } from "@/lib/auth-errors";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface VerifyEmailActionProps {
  mode: string;
  oobCode: string;
}

export default function VerifyEmailAction({ mode, oobCode }: VerifyEmailActionProps) {
  const started = useRef(false);
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (mode !== "verifyEmail" || !oobCode) {
      setError("This verification link is missing information or is not valid.");
      setStatus("error");
      return;
    }

    void Promise.resolve()
      .then(() => applyActionCode(getFirebaseAuth(), oobCode))
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        setError(friendlyAuthError(err));
        setStatus("error");
      });
  }, [mode, oobCode]);

  return (
    <Container component="main" maxWidth="sm" sx={{ py: { xs: 5, sm: 10 } }}>
      <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
        KasiTalent
      </Typography>
      <Paper variant="outlined" sx={{ mt: 2, p: { xs: 2.5, sm: 4 } }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1" fontWeight={800}>
            Verify your email
          </Typography>
          {status === "verifying" && (
            <Typography color="text.secondary">We&apos;re confirming your email address…</Typography>
          )}
          {status === "error" && (
            <>
              <Alert severity="error">{error}</Alert>
              <Button component={NextLink} href="/login" variant="contained">
                Go to login
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <Alert severity="success">Your email address is verified. You can now log in to KasiTalent.</Alert>
              <Button component={NextLink} href="/login?verified=1" variant="contained">
                Go to login
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      <Dialog open={status === "success"} aria-labelledby="verification-success-title">
        <DialogTitle id="verification-success-title">Email verified successfully</DialogTitle>
        <DialogContent>
          <Typography>Your KasiTalent account is ready. Log in to continue.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button component={NextLink} href="/login?verified=1" variant="contained" autoFocus>
            Go to login
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
