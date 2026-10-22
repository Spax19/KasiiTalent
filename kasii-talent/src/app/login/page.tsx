import { redirect } from "next/navigation";
import { Suspense } from "react";
import AuthForm from "../../components/auth/AuthForm";
import { getSessionUser } from "../../lib/auth";
import { safeNext } from "../../lib/safe-redirect";

export const metadata = { title: "Log in · KasiTalent" };

export default function LoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  const { next, verified } = await searchParams;
  const dest = safeNext(next);

  // Already logged in as an employer: skip the form.
  const user = await getSessionUser();
  if (user?.role === "employer") redirect(dest);

  return <AuthForm mode="login" next={dest} emailVerified={verified === "1"} />;
}
