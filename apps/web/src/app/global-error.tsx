"use client";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
              500
            </p>
            <h1 className="mt-4 text-3xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {error.message || "The application hit an unexpected error."}
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
