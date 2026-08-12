"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The three fields the brief asks for, plus the derived builder title.
 *
 * Limits come from the card, not from taste: at each layer's minimum type size
 * these are the lengths that fit on one line without shrinking (T-018). Only
 * the name is required — someone should be able to make a pass with a photo and
 * a name and nothing else.
 */

export type FieldName = "name" | "role" | "stack";

export const FIELD_LIMITS: Record<FieldName | "title", number> = {
  name: 28,
  role: 32,
  stack: 40,
  title: 24,
};

const FIELDS: ReadonlyArray<{
  id: FieldName;
  label: string;
  placeholder: string;
  hint?: string;
}> = [
  { id: "name", label: "Your name", placeholder: "Hitesh Solanki" },
  { id: "role", label: "Role", placeholder: "Software Engineer", hint: "Sets your builder class" },
  { id: "stack", label: "Stack", placeholder: "Next.js · TS · AWS" },
];

export function BuilderForm({
  values,
  title,
  onChange,
  onTitleChange,
  onReroll,
}: {
  values: Record<FieldName, string>;
  title: string;
  onChange: (field: FieldName, value: string) => void;
  onTitleChange: (value: string) => void;
  onReroll: () => void;
}) {
  return (
    <div className="space-y-4">
      {FIELDS.map((field) => (
        <div key={field.id}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <Label htmlFor={field.id}>{field.label}</Label>
            {field.hint ? (
              <span className="text-brand-cream/40 text-[10px]">{field.hint}</span>
            ) : null}
          </div>
          <Input
            id={field.id}
            value={values[field.id]}
            maxLength={FIELD_LIMITS[field.id]}
            placeholder={field.placeholder}
            autoComplete="off"
            onChange={(event) => onChange(field.id, event.target.value)}
          />
        </div>
      ))}

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Label htmlFor="title">Builder class</Label>
          <span className="text-brand-cream/40 text-[10px]">Derived — edit or reroll</span>
        </div>
        {/* `gap-4`, not `gap-2`: both controls cast a 5px offset shadow, so a
            tighter gutter drops the field's shadow under the reroll button. */}
        <div className="flex gap-4">
          <Input
            id="title"
            value={title}
            maxLength={FIELD_LIMITS.title}
            autoComplete="off"
            onChange={(event) => onTitleChange(event.target.value)}
            className="label-caps flex-1 md:text-[12px]"
          />
          {/*
           * Reroll cycles the pool for the current role, so pressing it enough
           * times returns you to where you started. Typing in the field above
           * takes over permanently — the table should never overwrite a person
           * who wanted "PROFESSIONAL YAK SHAVER".
           */}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onReroll}
            aria-label="Reroll builder class"
          >
            <RefreshCw />
          </Button>
        </div>
      </div>
    </div>
  );
}
