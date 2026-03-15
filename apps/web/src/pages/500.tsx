export default function Custom500() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          500
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The application hit an unexpected error.
        </p>
      </div>
    </main>
  );
}
