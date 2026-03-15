import { createUploadthing } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
const f = createUploadthing();
export const ourFileRouter = {
    imageUploader: f({
        image: {
            maxFileSize: "4MB",
            maxFileCount: 1,
        },
    })
        .middleware(async ({ req }) => {
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            throw new UploadThingError("Unauthorized");
        }
        return { userId };
    })
        .onUploadComplete(async ({ metadata, file }) => {
        return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),
};
