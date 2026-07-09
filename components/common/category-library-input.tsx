"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CategoryLibraryInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
  helperText?: string;
  name?: string;
}

export function CategoryLibraryInput({
  id,
  label,
  value,
  onChange,
  categories,
  placeholder,
  helperText,
  name,
}: CategoryLibraryInputProps) {
  const datalistId = `${id}-library`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        value={value}
        list={datalistId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <datalist id={datalistId}>
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const active = value.trim().toLowerCase() === category.toLowerCase();
          return (
            <button
              key={category}
              type="button"
              onClick={() => onChange(category)}
              className={`rounded-full border px-2 py-1 text-[10px] font-mono transition-colors ${
                active
                  ? "border-accent-soft-border bg-accent-soft-bg text-accent-soft-fg"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>
      {helperText ? (
        <p className="text-[10px] font-mono text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
