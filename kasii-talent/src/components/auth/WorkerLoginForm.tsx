"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface LoginChallenge {
  id: string;
  code: string;
  pollToken: string;
  expiresAt: number;
}

export default function WorkerLoginForm() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const whatsappLink = challenge && whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`LOGIN ${challenge.code}`)}`
    : null;

  useEffect(() => {
    if (!challenge) return;

    let stopped = false;
    let timeout: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch("/api/worker-login/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: challenge.id, pollToken: challenge.pollToken }),
        });
        const result = (await response.json().catch(() => ({}))) as {
          status?: string;
          customToken?: string;
          error?: string;
        };
        if (stopped) return;

        if (result.status === "pending") {
          if (!stopped) timeout = window.setTimeout(poll, 3000);
          return;
        }
        if (result.status === "expired") {
          setExpired(true);
          setBusy(false);
          return;
        }
        if (!response.ok || result.status !== "verified" || !result.customToken) {
          throw new Error(result.error ?? "Could not verify this sign-in. Start again.");
        }

        const credential = await signInWithCustomToken(getFirebaseAuth(), result.customToken);
        const idToken = await credential.user.getIdToken(true);
        const completionResponse = await fetch("/api/worker-login/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: challenge.id, pollToken: challenge.pollToken, idToken }),
        });
        const completionResult = (await completionResponse.json().catch(() => ({}))) as { error?: string };
        if (!completionResponse.ok) {
          throw new Error(completionResult.error ?? "Could not complete WhatsApp approval. Start again.");
        }

        const sessionResponse = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const sessionResult = (await sessionResponse.json().catch(() => ({}))) as { error?: string };
        if (!sessionResponse.ok) {
          throw new Error(sessionResult.error ?? "Could not finish signing in. Try again.");
        }

        router.replace("/worker/profile");
        router.refresh();
      } catch (pollError) {
        if (!stopped) {
          setError(pollError instanceof Error ? pollError.message : "Could not check sign-in status.");
          setBusy(false);
        }
      }
    };

    void poll();
    return () => {
      stopped = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [challenge, router]);

  async function startSignIn() {
    if (!whatsappNumber) {
      setError("WhatsApp sign-in is not configured. Add NEXT_PUBLIC_WHATSAPP_NUMBER to the app environment.");
      return;
    }

    setBusy(true);
    setExpired(false);
    setError(null);
    try {
      const response = await fetch("/api/worker-login/challenge", { method: "POST" });
      const result = (await response.json().catch(() => ({}))) as LoginChallenge & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not start WhatsApp sign-in.");
      setChallenge(result);
    } catch (startError) {
      setBusy(false);
      setError(startError instanceof Error ? startError.message : "Could not start WhatsApp sign-in.");
    }
  }

  function reset() {
    setChallenge(null);
    setBusy(false);
    setExpired(false);
    setError(null);
    setCopied(false);
  }

  async function copyWhatsAppLink() {
    if (!whatsappLink) return;
    try {
      await navigator.clipboard.writeText(whatsappLink);
      setCopied(true);
    } catch {
      setError("Could not copy the link. Use the QR code or Open WhatsApp button instead.");
    }
  }

  return (
    <Container component="main" maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
      <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
        KasiTalent
      </Typography>
      <Paper variant="outlined" sx={{ mt: 2, p: { xs: 2.5, sm: 4 } }}>
        <Typography component="h1" variant="h5" fontWeight={800}>
          Worker sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Approve sign-in from the WhatsApp number linked to your worker profile.
        </Typography>

        <Stack spacing={2} sx={{ mt: 3 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {!challenge || expired ? (
            <>
              {expired && <Alert severity="warning">This sign-in link expired. Start again to get a new one.</Alert>}
              <Button variant="contained" size="large" onClick={startSignIn} disabled={busy}>
                {busy ? "Waiting for WhatsApp approval…" : expired ? "Create a new sign-in link" : "Continue with WhatsApp"}
              </Button>
            </>
          ) : (
            <>
              {whatsappLink && (
                <Box sx={{ display: "grid", justifyItems: "center", gap: 2, py: 1 }}>
                  <Box sx={{ bgcolor: "common.white", p: 1.5, border: 1, borderColor: "divider", lineHeight: 0 }}>
                    <QRCodeSVG value={whatsappLink} size={216} level="M" includeMargin />
                  </Box>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Scan with your phone, or open WhatsApp on this device.
                  </Typography>
                  <Button component="a" href={whatsappLink} target="_blank" rel="noreferrer" variant="outlined">
                    Open WhatsApp
                  </Button>
                  <Button onClick={copyWhatsAppLink} startIcon={<ContentCopyIcon />}>
                    {copied ? "Link copied" : "Copy WhatsApp link"}
                  </Button>
                </Box>
              )}
              {busy && <Alert severity="info">Waiting for approval. This link expires in 3 minutes.</Alert>}
              <Button onClick={reset} color="inherit">
                Cancel sign in
              </Button>
            </>
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Hiring workers? <Link href="/login">Business sign in</Link>
        </Typography>
      </Paper>
    </Container>
  );
}