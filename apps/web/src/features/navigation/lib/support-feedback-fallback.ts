export function isMissingTrpcProcedureError(
  error: unknown,
  procedurePath: string
) {
  return (
    error instanceof Error &&
    error.message.includes(`No procedure found on path "${procedurePath}"`)
  );
}
