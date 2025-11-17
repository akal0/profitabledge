import * as React from "react";
import MultipleSelector, { type Option } from "@/components/ui/multiselect";

export default function TradeMultiSelect({
  symbols,
  value,
  onChange,
  placeholder = "Select symbols",
}: {
  symbols: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const options = React.useMemo<Option[]>(
    () => symbols.map((s) => ({ value: s, label: s })),
    [symbols]
  );
  const selected = React.useMemo<Option[]>(
    () => value.map((s) => ({ value: s, label: s })),
    [value]
  );
  return (
    <MultipleSelector
      commandProps={{ label: "Select symbols" }}
      value={selected}
      options={options}
      onChange={(opts) => onChange(opts.map((o) => o.value))}
      placeholder={placeholder}
      hideClearAllButton
      hidePlaceholderWhenSelected
      emptyIndicator={
        <p className="text-center text-xs">There are no symbols.</p>
      }
    />
  );
}
