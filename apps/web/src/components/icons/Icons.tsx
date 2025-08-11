import React from "react";

export const Icons = {
  ArrowUpRight: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M8 6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 1 1-2 0V8.414L6.957 18.457a1 1 0 0 1-1.414-1.414L15.586 7H9a1 1 0 0 1-1-1"
        clipRule="evenodd"
      />
    </svg>
  ),
};
