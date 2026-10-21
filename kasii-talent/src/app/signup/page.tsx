import { redirect } from "next/navigation";
import AuthForm from "../../components/auth/AuthForm";
import { getSessionUser } from "../../lib/auth";
import { safeNext } from "../../lib/safe-redirect";

export const metadata = { title: "Create a business account · KasiTalent" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next);

  const user = await getSessionUser();
  if (user?.role === "employer") redirect(dest);

  return <AuthForm mode="signup" next={dest} />;
}
