import { redirect } from "next/navigation";
import AuthForm from "@/components/auth/AuthForm";
import { getSessionUser } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

export const metadata = { title: "Log in · KasiTalent" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  const { next, verified } = await searchParams;
  const dest = safeNext(next);

  const user = await getSessionUser();
  if (user?.role === "employer") redirect(dest);
  if (user?.role === "worker") redirect("/worker/dashboard");

  return <AuthForm mode="login" next={dest} emailVerified={verified === "1"} />;
}
