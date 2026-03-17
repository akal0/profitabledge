export default function PublicProofLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full self-start bg-sidebar">{children}</div>
  );
}
