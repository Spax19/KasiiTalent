import { redirect } from "next/navigation";
import WorkerLoginForm from "@/components/worker/WorkerLoginForm";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Worker sign in · KasiTalent" };
export const dynamic = "force-dynamic";

export default async function WorkerLoginPage() {
  const user = await getSessionUser();
  if (user?.role === "worker") redirect("/worker/dashboard");
  if (user?.role === "employer") redirect("/dashboard");

  return <WorkerLoginForm />;
}
