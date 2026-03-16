import React from "react";
import BaseMediaUpload, { type BaseMediaUploadProps } from "./BaseMediaUpload";

export type CsvUploadProps = Omit<
  BaseMediaUploadProps,
  "accept"
> & {
  onFileChange?: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
};

const CsvUpload: React.FC<CsvUploadProps> = ({
  onFileChange,
  onFilesChange,
  multiple = false,
  maxSize,
  disabled,
  className,
}) => {
  return (
    <BaseMediaUpload
      accept=".csv,text/csv,.xml,text/xml,application/xml,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xls"
      multiple={multiple}
      maxSize={maxSize}
      disabled={disabled}
      className={className}
      title="Upload CSV, XML, or XLSX"
      description={undefined}
      onFilesChange={(files) => {
        onFileChange?.(files[0] ?? null);
        onFilesChange?.(files);
      }}
    />
  );
};

export default CsvUpload;
