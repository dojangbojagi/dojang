"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Chip } from "@/components/lending-v2/v2-parts";

export type WitnessUploadStatus = "idle" | "loading" | "loaded" | "invalid";

/* A witness is a few hundred bytes of JSON; anything near this size is not one. Checked before the file is read at all. */
const MAX_BYTES = 256 * 1024;

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);
const FileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 3.5h6.5L18.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
    <path d="M13.5 3.5v5h5" />
    <path d="M9.2 12.2c-.7 0-1 .4-1 1v.6c0 .5-.3.8-.8.8.5 0 .8.3.8.8v.6c0 .6.3 1 1 1M14.8 12.2c.7 0 1 .4 1 1v.6c0 .5.3.8.8.8-.5 0-.8.3-.8.8v.6c0 .6-.3 1-1 1" />
  </svg>
);

/**
 * The private witness picker. Presentation only: it hands the chosen file to `onFile` and shows what the
 * caller says happened. Reading, parsing and checking the file stay with the caller; nothing leaves the browser.
 * A real <input type="file"> sits under the custom surface, so the keyboard, assistive technology and the
 * operating system's own picker all keep working.
 */
export function WitnessUpload({ disabled, disabledReason, fileName, status, message, loadedFor, onFile, onRejected, onRemove,
  title = "Import private witness", idleTitle = "Drop the witness JSON here",
  idleHint = "or choose it from your device. The file your project issuer delivered, ending in .json.",
  loadedLabel = "Witness loaded", fileDescription = "witness file",
}: {
  disabled: boolean;
  disabledReason?: string;
  fileName: string;
  status: WitnessUploadStatus;
  message: string;
  loadedFor?: string;
  title?: string;
  idleTitle?: string;
  idleHint?: string;
  loadedLabel?: string;
  fileDescription?: string;
  onFile: (file: File) => void;
  onRejected?: (file: File, reason: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localFileName, setLocalFileName] = useState("");
  const titleId = `${id}-title`;
  const hintId = `${id}-hint`;
  const statusId = `${id}-status`;
  const displayFileName = fileName || localFileName;
  const rejected = status === "invalid" || Boolean(localError);

  const pick = (file?: File | null) => {
    if (!file || disabled) return;
    setLocalError("");
    setLocalFileName(file.name);
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") {
      const reason = `That is not a .json file. Choose the ${fileDescription} prepared for this wallet.`;
      setLocalError(reason);
      onRejected?.(file, reason);
      return;
    }
    if (file.size > MAX_BYTES) {
      const reason = `That file is too large to be a ${fileDescription} (the limit is 256 KB).`;
      setLocalError(reason);
      onRejected?.(file, reason);
      return;
    }
    onFile(file);
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    pick(event.currentTarget.files?.[0]);
    event.currentTarget.value = ""; /* so the same file can be chosen again after a fix */
  };
  const openPicker = () => inputRef.current?.click();

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  };
  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    pick(event.dataTransfer.files?.[0]);
  };
  const remove = () => {
    setLocalError("");
    setLocalFileName("");
    onRemove();
  };

  const error = localError || (status === "invalid" ? message : "");
  const note = !error && message ? message : "";

  return (
    <div
      className="lendv2-witness"
      data-state={status}
      data-over={over ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="lendv2-witness__head">
        <h3 id={titleId} className="lendv2-witness__title">{title}</h3>
        <Chip tone={status === "loaded" ? "valid" : rejected ? "invalid" : status === "loading" ? "pending" : "demo"}>
          {status === "loaded" ? loadedLabel : rejected ? "Not accepted" : status === "loading" ? "Reading locally" : "Stays in this browser"}
        </Chip>
      </div>

      <input
        ref={inputRef}
        id={id}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        disabled={disabled || status === "loading"}
        aria-labelledby={titleId}
        aria-describedby={`${hintId} ${statusId}`}
        onChange={onChange}
      />

      {status === "idle" && !localError ? (
        <label className="lendv2-drop" htmlFor={id}>
          <span className="lendv2-drop__icon" aria-hidden="true"><FileIcon /></span>
          <span className="lendv2-drop__copy">
          <span className="lendv2-drop__title">{over ? "Release to import" : idleTitle}</span>
            <span className="lendv2-drop__hint" id={hintId}>
              {disabled && disabledReason ? disabledReason : idleHint}
            </span>
          </span>
          <span className="btn btn--secondary btn--sm lendv2-drop__cta" aria-hidden="true">Choose file</span>
        </label>
      ) : (
        <div className="lendv2-file" data-tone={status === "loaded" ? "ok" : status === "loading" ? "pending" : "bad"}>
          <span className="lendv2-file__icon" aria-hidden="true"><FileIcon /></span>
          <span className="lendv2-file__body">
            <strong className="lendv2-file__name">{displayFileName || (status === "loading" ? "Reading witness…" : "Credential issued in this browser")}</strong>
            <span className="lendv2-file__meta" id={hintId}>
              {status === "loading"
                ? "Checking the file locally in this browser."
                : status === "loaded"
                  ? <>Bound to <span className="addr">{loadedFor}</span> · held in memory only</>
                  : "This file was not accepted. Your previous witness, if any, was cleared."}
            </span>
          </span>
          <span className="lendv2-file__actions">
            <button className="btn btn--secondary btn--sm" type="button" onClick={openPicker} disabled={disabled || status === "loading"}>
              {status === "loaded" ? "Replace" : "Choose another"}
            </button>
            <button className="btn btn--secondary btn--sm" type="button" onClick={remove} disabled={status === "loading" || (status !== "loaded" && !displayFileName && !localError)}>
              {status === "loaded" ? "Remove" : "Dismiss"}
            </button>
          </span>
        </div>
      )}

      <div id={statusId} aria-live="polite">
        {error ? <p className="lendv2-witness__error" role="alert">{error}</p> : null}
        {note ? <p className="lendv2-witness__note">{note}</p> : null}
      </div>

      <p className="lendv2-witness__privacy">
        <LockIcon />
        <span>
          <strong>Private by design.</strong> The file is read by this page in your browser and kept in memory only.
          It is never uploaded, sent to a server or stored. Remove it, or close the tab, and it is gone.
        </span>
      </p>
    </div>
  );
}
