import React from "react";
import BaseMediaUpload, { type BaseMediaUploadProps } from "./BaseMediaUpload";

export type AvatarUploadProps = Omit<
  BaseMediaUploadProps,
  "accept" | "multiple"
> & {
  onFileChange?: (file: File | null) => void;
};

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  onFileChange,
  maxSize,
  disabled,
  className,
  title = "Upload avatar",
  description,
}) => {
  return (
    <BaseMediaUpload
      accept="image/*"
      multiple={false}
      maxSize={maxSize}
      disabled={disabled}
      className={className}
      title={title}
      description={description}
      onFilesChange={(files) => onFileChange?.(files[0] ?? null)}
    />
  );
};

export default AvatarUpload;
