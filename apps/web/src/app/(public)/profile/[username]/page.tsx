"use client";

import { useParams } from "next/navigation";

export default function PublicProfilePage() {
  const params = useParams();
  const username =
    typeof params?.username === "string" ? params.username : "user";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-24 text-gray-900 dark:bg-gray-900 dark:text-white">
      <div className="mx-auto max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-white/5">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-500 dark:text-white/45">
          Alpha preview
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Public profiles are not live yet</h1>
        <p className="mt-4 text-sm leading-6 text-gray-600 dark:text-white/65">
          The profile surface for <span className="font-medium">@{username}</span> is
          being held back until the supporting follow, sharing, and public-profile
          APIs are fully wired. During alpha, verified public sharing remains limited
          to supported share pages and track-record surfaces.
        </p>
      </div>
    </div>
  );
}
