import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "../../../server/src/app/api/uploadthing/core";

const baseEnv = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, "");
if (!baseEnv) {
  throw new Error(
    "NEXT_PUBLIC_SERVER_URL must be set to your server origin (e.g. http://localhost:3000)"
  );
}
const uploadthingUrl = `${baseEnv}/api/uploadthing`;

export const { useUploadThing, uploadFiles, getRouteConfig } =
  generateReactHelpers<OurFileRouter>({ url: uploadthingUrl });
