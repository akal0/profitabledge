import { redirect } from "next/navigation";

export default async function PublicProofRedirectPage({
  params,
}: {
  params: Promise<{ username: string; publicAccountSlug: string }>;
}) {
  const { username, publicAccountSlug } = await params;
  redirect(`/${username}/${publicAccountSlug}/trades`);
}
