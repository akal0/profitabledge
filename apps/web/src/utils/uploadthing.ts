import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";
import type { OurFileRouter } from "../../../server/src/app/api/uploadthing/core";

// Point to server origin if different from web origin
const uploadthingUrl = `${process.env.NEXT_PUBLIC_SERVER_URL}/api/uploadthing`;

export const UploadButton = generateUploadButton<OurFileRouter>({
  url: uploadthingUrl,
});
export const UploadDropzone = generateUploadDropzone<OurFileRouter>({
  url: uploadthingUrl,
});
export const { useUploadThing, uploadFiles, getRouteConfig } =
  generateReactHelpers<OurFileRouter>({ url: uploadthingUrl });
