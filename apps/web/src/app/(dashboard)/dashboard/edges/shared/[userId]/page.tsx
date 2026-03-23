import { redirect } from "next/navigation";

export default async function LegacyEdgeLibraryRedirect({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/dashboard/edges/library/${userId}`);
}
