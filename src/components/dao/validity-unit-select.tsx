"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ValidityUnit } from "@/components/dao/format";

export const VALIDITY_UNIT_OPTIONS: readonly { value: ValidityUnit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "hours", label: "Hours" },
  { value: "minutes", label: "Minutes" },
  { value: "seconds", label: "Seconds" },
];

export function ValidityUnitSelect({ value, onChange, disabled, labelId }: {
  value: ValidityUnit;
  onChange: (value: ValidityUnit) => void;
  disabled?: boolean;
  labelId: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(0, VALIDITY_UNIT_OPTIONS.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  useEffect(() => {
    if (!open) return;
    listboxRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function choose(index: number) {
    const option = VALIDITY_UNIT_OPTIONS[index];
    if (!option || disabled) return;
    onChange(option.value);
    setActiveIndex(index);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) {
        setActiveIndex(selectedIndex);
        setOpen(true);
      } else if (event.key === "Home") setActiveIndex(0);
      else if (event.key === "End") setActiveIndex(VALIDITY_UNIT_OPTIONS.length - 1);
      else setActiveIndex((current) => (current + (event.key === "ArrowDown" ? 1 : -1) + VALIDITY_UNIT_OPTIONS.length) % VALIDITY_UNIT_OPTIONS.length);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else {
        setActiveIndex(selectedIndex);
        setOpen(true);
      }
    }
  }

  const selected = VALIDITY_UNIT_OPTIONS[selectedIndex];

  return (
    <div className="dao-unit-select" ref={rootRef} data-open={open ? "true" : "false"} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        className="dao-unit-select__trigger"
        type="button"
        role="combobox"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else { setActiveIndex(selectedIndex); setOpen(true); }
        }}
      >
        <span>{selected.label}</span>
        <svg className="dao-unit-select__chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" /></svg>
      </button>
      <div
        ref={listboxRef}
        id={`${id}-listbox`}
        className="dao-unit-select__listbox"
        role="listbox"
        aria-labelledby={labelId}
        aria-activedescendant={`${id}-option-${activeIndex}`}
        tabIndex={-1}
        hidden={!open}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        {VALIDITY_UNIT_OPTIONS.map((option, index) => (
          <div
            key={option.value}
            id={`${id}-option-${index}`}
            className="dao-unit-select__option"
            role="option"
            aria-selected={option.value === value}
            data-active={index === activeIndex ? "true" : undefined}
            onMouseMove={() => setActiveIndex(index)}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            {option.value === value && <span className="dao-unit-select__selected" aria-hidden="true">Selected</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
