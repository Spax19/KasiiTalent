import type { Metadata } from "next";
import VerifyEmailAction from "../../components/auth/VerifyEmailAction";

export const metadata: Metadata = { title: "Verify your email · KasiTalent" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; oobCode?: string }>;
}) {
  const { mode, oobCode } = await searchParams;

  return <VerifyEmailAction mode={mode ?? ""} oobCode={oobCode ?? ""} />;
}
