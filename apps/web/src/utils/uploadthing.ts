import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@profitabledge/contracts/uploadthing";

export const { useUploadThing, uploadFiles, getRouteConfig } =
  generateReactHelpers<OurFileRouter>({ url: "/api/uploadthing" });
