import React from "react";
import BaseMediaUpload, { type BaseMediaUploadProps } from "./BaseMediaUpload";

export type CsvUploadProps = Omit<
  BaseMediaUploadProps,
  "accept" | "multiple"
> & {
  onFileChange?: (file: File | null) => void;
};

const CsvUpload: React.FC<CsvUploadProps> = ({
  onFileChange,
  maxSize,
  disabled,
  className,
}) => {
  return (
    <BaseMediaUpload
      accept=".csv,text/csv"
      multiple={false}
      maxSize={maxSize}
      disabled={disabled}
      className={className}
      title="Upload CSV"
      description={undefined}
      onFilesChange={(files) => onFileChange?.(files[0] ?? null)}
    />
  );
};

export default CsvUpload;
