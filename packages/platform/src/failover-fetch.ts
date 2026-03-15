export async function fetchFirstAvailable(
  targets: Array<RequestInfo | URL>,
  init?: RequestInit
): Promise<Response> {
  let lastError: unknown;

  for (const target of targets) {
    try {
      return await fetch(target, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No failover fetch target succeeded.");
}
