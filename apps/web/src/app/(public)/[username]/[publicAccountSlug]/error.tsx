"use client";

import Link from "next/link";

import { GoalSurface } from "@/components/goals/goal-surface";
import { Button } from "@/components/ui/button";

export default function PublicProofError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="min-h-screen h-full w-full bg-sidebar px-4 py-24 text-white md:px-6 lg:px-8">
      <div className="w-full">
        <GoalSurface className="mx-auto w-full max-w-3xl">
          <div className="px-8 py-10 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">
              Public proof
            </p>
            <h1 className="mt-4 text-3xl font-semibold">
              Proof page unavailable
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/55">
              {error.message ||
                "This public proof link is invalid, revoked, or no longer active."}
            </p>
            <Button
              className="mt-6 rounded-sm bg-teal-500 text-black hover:bg-teal-400"
              asChild
            >
              <Link href="/sign-up">Create your own proof page</Link>
            </Button>
          </div>
        </GoalSurface>
      </div>
    </div>
  );
}
