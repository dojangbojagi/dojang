"use client";

import { useId } from "react";

interface AmountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  /** Fills the field with the largest amount the app can offer; leave undefined when none is safe to offer. */
  onMax?: () => void;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
}

export function AmountField({ label, value, onChange, symbol, onMax, error, hint, disabled }: AmountFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="lend-field">
      <label className="lend-field__label" htmlFor={id}>{label}</label>
      <div className="lend-field__box" data-invalid={error ? "true" : undefined} data-disabled={disabled ? "true" : undefined}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.0"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <span className="lend-field__symbol">{symbol}</span>
        {onMax && <button type="button" className="lend-field__max" onClick={onMax} disabled={disabled}>Max</button>}
      </div>
      {error && <p className="lend-field__error" id={`${id}-error`} role="alert">{error}</p>}
      {hint && !error && <p className="lend-field__hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}
