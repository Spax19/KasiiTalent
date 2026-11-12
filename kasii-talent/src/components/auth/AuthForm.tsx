"use client";
import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { friendlyAuthError } from "../../lib/auth-errors";
import { getFirebaseAuth } from "../../lib/firebase/client";

type Mode = "login" | "signup";

interface AuthFormProps {
  mode: Mode;
  next: string;
  emailVerified?: boolean;
}


async function createServerSession(user: User): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const idToken = await user.getIdToken(true);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, role: "employer" }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; refresh?: boolean; error?: string };

    if (res.ok && data.ok) return;
    if (res.ok && data.refresh) continue;
    if (res.status === 403) throw new Error("This account is not set up as a business account.");
    throw new Error(data.error ?? "Could not sign you in. Please try again.");
  }
  throw new Error("Could not finish signing you in. Please try again.");
}

async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user, {
    url: `${window.location.origin}/login?verified=1`,
    handleCodeInApp: false,
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container component="main" maxWidth="xs" sx={{ py: { xs: 4, sm: 8 } }}>
      <Typography component="a" href="/" variant="h6" fontWeight={800} color="primary" sx={{ textDecoration: "none" }}>
        KasiTalent
      </Typography>
      <Paper variant="outlined" sx={{ mt: 2, p: { xs: 2.5, sm: 4 } }}>
        {children}
      </Paper>
    </Container>
  );
}

export default function AuthForm({ mode, next, emailVerified = false }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";

  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    emailVerified ? "Email verified successfully. You can now log in." : null,
  );
  
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  async function complete(user: User) {
    await createServerSession(user);
    router.replace(next);
    router.refresh();
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void run(async () => {
      const auth = getFirebaseAuth();

      if (isSignup) {
        const name = businessName.trim();
        if (name.length < 2 || name.length > 80) throw new Error("Please enter your business name.");
        if (password.length < 8) throw new Error("Use a password of at least 8 characters.");
        if (!agreed) throw new Error("Please tick the box to continue.");

        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name });
        await sendVerificationEmail(cred.user);
        setPendingUser(cred.user);
        setInfo(`We sent a verification link to ${cred.user.email}. Open it to verify your email, then return here to log in.`);
        return;
      }

      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await cred.user.reload();
      if (!cred.user.emailVerified) {
        setPendingUser(cred.user);
        setError("Please verify your email first. Check your inbox (and spam) for the link we sent.");
        return;
      }
      await complete(cred.user);
    });
  }

  function onGoogle() {
    void run(async () => {
      if (isSignup && !agreed) throw new Error("Please tick the box to continue.");
      const cred = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      await complete(cred.user);
    });
  }

  function onForgotPassword() {
    void run(async () => {
      if (!email.trim()) throw new Error("Type your email in the box above first.");
      try {
        await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      } catch (err) {
        // Do not reveal whether an account exists for this email.
        if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
      }
      setInfo("If that email has an account, a reset link is on its way.");
    });
  }

  /* ---------------- Waiting for email verification ---------------- */
  if (pendingUser) {
    return (
      <Shell>
        <Typography variant="h5" component="h1" fontWeight={800}>
          Verify your email
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {info && <Alert severity="info">{info}</Alert>}
          {error && <Alert severity="warning">{error}</Alert>}
          <Button
            component={NextLink}
            href={`/login?next=${encodeURIComponent(next)}`}
            variant="contained"
            size="large"
            disabled={busy}
          >
            Go to login
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await sendVerificationEmail(pendingUser);
                setInfo("Sent again. Check your inbox and spam folder.");
              })
            }
          >
            Resend email
          </Button>
          <Button
            color="inherit"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await signOut(getFirebaseAuth());
                setPendingUser(null);
              })
            }
          >
            Use a different email
          </Button>
        </Stack>
      </Shell>
    );
  }

  /* ---------------- Main form ---------------- */
  const otherHref = `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`;

  return (
    <Shell>
      <Typography variant="h5" component="h1" fontWeight={800}>
        {isSignup ? "Create a business account" : "Log in"}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {isSignup
          ? "Find skilled people from your kasi and see proof of their work."
          : "Welcome back. Log in to find local talent."}
      </Typography>

      <Box component="form" noValidate onSubmit={onSubmit} sx={{ mt: 3 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="info">{info}</Alert>}

          {isSignup && (
            <TextField
              label="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              fullWidth
              disabled={busy}
              autoComplete="organization"
            />
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            disabled={busy}
            autoComplete="email"
          />

          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            disabled={busy}
            autoComplete={isSignup ? "new-password" : "current-password"}
            helperText={isSignup ? "At least 8 characters" : undefined}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {isSignup && (
            <FormControlLabel
              control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
              label={
                <Typography variant="body2">
                  I have read the{" "}
                  <Link href="/privacy" target="_blank" onClick={(e) => e.stopPropagation()}>
                    privacy notice
                  </Link>{" "}
                  and will only use workers&apos; details to consider them for work.
                </Typography>
              }
            />
          )}

          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </Button>

          {!isSignup && (
            <Link component="button" type="button" variant="body2" onClick={onForgotPassword} disabled={busy} sx={{ alignSelf: "flex-start" }}>
              Forgot password?
            </Link>
          )}

          <Divider>or</Divider>

          <Button variant="outlined" color="inherit" size="large" startIcon={<GoogleIcon />} onClick={onGoogle} disabled={busy}>
            Continue with Google
          </Button>
        </Stack>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        {isSignup ? "Already have an account? " : "New here? "}
        <Link component={NextLink} href={otherHref}>
          {isSignup ? "Log in" : "Create a business account"}
        </Link>
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        Looking for work? You do not need an account here. Just say hi to us on WhatsApp.
          <br />
          <Link component={NextLink} href="/worker/login">Already have a worker profile? Sign in</Link>
      </Typography>
    </Shell>
  );
}
