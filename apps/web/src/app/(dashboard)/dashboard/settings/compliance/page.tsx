import { redirect } from "next/navigation";

export default function ComplianceSettingsPage() {
  redirect("/dashboard/settings/rules#guardrails");
}
