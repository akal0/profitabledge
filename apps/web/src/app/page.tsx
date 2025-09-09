"use client";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";
import Header from "@/components/header";

export default function Home() {
  return (
    <main>
      <Header />
      <div>header</div>
    </main>
  );
}
