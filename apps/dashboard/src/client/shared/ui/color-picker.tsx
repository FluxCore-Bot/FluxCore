import { cn } from "../lib/utils";
import { Input } from "./input";
import type { ChangeEvent } from "react";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div
          className="h-9 w-9 shrink-0 rounded-md border border-border"
          style={{ backgroundColor: value || "#000000" }}
        />
      </div>
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="w-28 font-mono text-xs"
      />
    </div>
  );
}
