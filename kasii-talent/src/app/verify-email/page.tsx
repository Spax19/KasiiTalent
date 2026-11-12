import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailAction from "../../components/auth/VerifyEmailAction";

export const metadata: Metadata = { title: "Verify your email · KasiTalent" };

export default function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ mode?: string; oobCode?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; oobCode?: string }>;
}) {
  const { mode, oobCode } = await searchParams;

  return <VerifyEmailAction mode={mode ?? ""} oobCode={oobCode ?? ""} />;
}
