"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import Button from "@mui/material/Button";
import { getFirebaseAuth } from "@/lib/firebase/client";

export default function SignOutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/session", { method: "DELETE" }); // clears the httpOnly cookie
      await signOut(getFirebaseAuth()).catch(() => undefined);
    } finally {
      router.replace(redirectTo);
      router.refresh();
    }
  }

  return (
    <Button color="inherit" onClick={onClick} disabled={busy}>
      Log out
    </Button>
  );
}
