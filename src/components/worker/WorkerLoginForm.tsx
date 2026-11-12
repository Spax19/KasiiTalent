"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RecaptchaVerifier, signInWithPhoneNumber, signOut, type ConfirmationResult } from "firebase/auth";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ColorModeToggle from "@/components/ColorModeToggle";
import { getFirebaseAuth } from "@/lib/firebase/client";

function formatPhoneNumber(value: string): string | null {
  const input = value.trim().replace(/[\s()-]/g, "");
  if (/^0[6-8]\d{8}$/.test(input)) return `+27${input.slice(1)}`;
  if (/^27[6-8]\d{8}$/.test(input)) return `+${input}`;
  if (/^\+27[6-8]\d{8}$/.test(input)) return input;
  return null;
}

export default function WorkerLoginForm() {
  const router = useRouter();
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");

  useEffect(() => () => verifier.current?.clear(), []);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      setError("Enter a valid South African mobile number, for example 082 123 4567.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      verifier.current ??= new RecaptchaVerifier(auth, "worker-phone-recaptcha", { size: "invisible" });
      setConfirmation(await signInWithPhoneNumber(auth, formattedPhone, verifier.current));
    } catch (err) {
      verifier.current?.clear();
      verifier.current = null;
      setError(err instanceof Error ? err.message : "Could not send a verification code. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmation) return;
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code sent to your phone.");
      return;
    }

    setBusy(true);
    setError(null);
    const auth = getFirebaseAuth();
    try {
      const credential = await confirmation.confirm(code.trim());
      const token = await credential.user.getIdToken(true);
      const role = (await credential.user.getIdTokenResult()).claims.role;
      if (role !== "worker") {
        await signOut(auth);
        throw new Error("No worker profile is linked to that number. Create a profile on WhatsApp first.");
      }

      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token, role: "worker" }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || !data.ok) {
        await signOut(auth);
        throw new Error(data.error ?? "Could not sign you in. Please try again.");
      }

      router.replace("/worker/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The code could not be verified. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container component="main" maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
          KasiTalent
        </Typography>
        <ColorModeToggle />
      </Box>
      <Paper variant="outlined" sx={{ mt: 2, p: { xs: 2.5, sm: 4 } }}>
        <Typography variant="h5" component="h1" fontWeight={800}>
          Worker sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Use the South African mobile number linked to your KasiTalent worker profile.
        </Typography>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={confirmation ? verifyCode : sendCode}>
          <Stack spacing={2} sx={{ mt: 3 }}>
            {!confirmation ? (
              <>
                <TextField
                  label="Mobile number"
                  placeholder="082 123 4567"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  autoComplete="tel"
                  required
                  fullWidth
                  disabled={busy}
                />
                <Box id="worker-phone-recaptcha" />
                <Button type="submit" variant="contained" size="large" disabled={busy}>
                  {busy ? "Sending code…" : "Send sign-in code"}
                </Button>
              </>
            ) : (
              <>
                <TextField
                  label="6-digit verification code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]{6}", maxLength: 6 }}
                  autoComplete="one-time-code"
                  required
                  fullWidth
                  disabled={busy}
                />
                <Button type="submit" variant="contained" size="large" disabled={busy}>
                  {busy ? "Verifying…" : "Verify and continue"}
                </Button>
                <Button
                  color="inherit"
                  disabled={busy}
                  onClick={() => {
                    setConfirmation(null);
                    setCode("");
                    setError(null);
                  }}
                >
                  Use a different number
                </Button>
              </>
            )}
          </Stack>
        </Box>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        New to KasiTalent? Create your worker profile by messaging us on{" "}
        <Link
          href={whatsappNumber ? `https://wa.me/${whatsappNumber}?text=Hi` : "/"}
          underline="always"
          target={whatsappNumber ? "_blank" : undefined}
          rel={whatsappNumber ? "noreferrer" : undefined}
        >
          WhatsApp
        </Link>.
      </Typography>
      <Typography component="a" href="/login" variant="body2" sx={{ display: "block", mt: 1.5 }}>
        Business account sign in
      </Typography>
    </Container>
  );
}
