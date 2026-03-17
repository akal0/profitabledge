export default function Custom404() {
  return (
    <main className="flex min-h-screen min-w-screen h-full w-full items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you requested does not exist.
        </p>
      </div>
    </main>
  );
}
