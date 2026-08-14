"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  File,
  SpinnerGap,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

import { formatUsd } from "@/lib/payments/pricing";

type Job = {
  id: string;
  status: string;
  estimatedMaxChargeCents: number | null;
  chargedCents: number;
  pageTotal: number | null;
};

type Phase = "idle" | "uploading" | "inspecting" | "quote" | "running" | "complete" | "error";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function UploadCard({ liveEnabled }: { liveEnabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File>();
  const [job, setJob] = useState<Job>();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!["quote", "complete", "error"].includes(phase)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function reset() {
    setPhase("idle");
    setFile(undefined);
    setJob(undefined);
    setError(undefined);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function pollJob(jobId: string, until: Set<string>) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      const payload = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !payload.job) throw new Error(payload.error || "Could not read job status");
      setJob(payload.job);
      if (until.has(payload.job.status)) return payload.job;
      await sleep(2_000);
    }
    throw new Error("The job is taking longer than expected. It remains visible in History.");
  }

  async function begin(selectedFile: File) {
    setError(undefined);
    if (!allowedTypes.has(selectedFile.type)) {
      setError("Use a PDF, JPEG, or PNG file.");
      setPhase("error");
      return;
    }
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError("Files can be up to 100 MB.");
      setPhase("error");
      return;
    }
    setFile(selectedFile);

    if (!liveEnabled) {
      setPhase("inspecting");
      await sleep(700);
      setJob({ id: "preview-job", status: "awaiting_confirmation", estimatedMaxChargeCents: 72, chargedCents: 0, pageTotal: 1 });
      setPhase("quote");
      return;
    }

    try {
      setPhase("uploading");
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName: selectedFile.name, contentType: selectedFile.type, bytes: selectedFile.size }),
      });
      const presign = (await presignResponse.json()) as { uploadUrl?: string; objectKey?: string; error?: string };
      if (!presignResponse.ok || !presign.uploadUrl || !presign.objectKey) throw new Error(presign.error || "Could not prepare upload");
      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "content-type": selectedFile.type },
        body: selectedFile,
      });
      if (!uploadResponse.ok) throw new Error("The direct upload failed");
      const completeResponse = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objectKey: presign.objectKey }),
      });
      if (!completeResponse.ok) throw new Error("The uploaded file could not be verified");
      setPhase("inspecting");
      const createResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objectKey: presign.objectKey, fileName: selectedFile.name, contentType: selectedFile.type, bytes: selectedFile.size }),
      });
      const created = (await createResponse.json()) as { job?: Job; error?: string };
      if (!createResponse.ok || !created.job) throw new Error(created.error || "Could not create job");
      setJob(created.job);
      const inspected = await pollJob(created.job.id, new Set(["awaiting_confirmation", "failed"]));
      if (inspected.status === "failed") throw new Error("The document could not be inspected safely");
      setPhase("quote");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
      setPhase("error");
    }
  }

  async function confirm() {
    if (!job) return;
    if (!liveEnabled) {
      setPhase("running");
      await sleep(1_400);
      setJob({ ...job, status: "succeeded", chargedCents: 58 });
      setPhase("complete");
      return;
    }
    try {
      setPhase("running");
      const response = await fetch(`/api/jobs/${job.id}/confirm`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not confirm job");
      const completed = await pollJob(job.id, new Set(["succeeded", "partial", "failed"]));
      if (completed.status === "failed") throw new Error("The job failed without charging your wallet");
      setPhase("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job failed");
      setPhase("error");
    }
  }

  const busy = ["uploading", "inspecting", "running"].includes(phase);

  return (
    <>
      <div
        className={dragging ? "upload-zone dragging" : "upload-zone"}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) void begin(dropped);
        }}
      >
        {busy ? <SpinnerGap className="spin upload-icon" size={48} /> : <UploadSimple className="upload-icon" size={48} weight="light" />}
        <strong>{phase === "uploading" ? "Uploading directly…" : phase === "inspecting" ? "Inspecting safely…" : phase === "running" ? "Cleaning and verifying…" : "Drop a PDF, JPEG, or PNG"}</strong>
        <span>{file ? file.name : "One job at a time · Nothing stored permanently"}</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          hidden
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void begin(selected);
          }}
        />
        <button className="primary-button upload-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? "Please wait" : "Choose file"}
        </button>
      </div>

      {phase === "quote" && job ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={reset}>
          <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={reset} aria-label="Cancel job"><X size={20} /></button>
            <div className="modal-icon"><File size={25} /></div>
            <p className="eyebrow">Ready to clean</p>
            <h2 id="quote-title">Review the maximum price</h2>
            <div className="quote-summary">
              <div><span>File</span><strong>{file?.name}</strong></div>
              <div><span>Pages</span><strong>{job.pageTotal ?? "—"}</strong></div>
              <div><span>Maximum</span><strong>{formatUsd(job.estimatedMaxChargeCents ?? 0)}</strong></div>
            </div>
            <p className="modal-copy">We bill only pages that pass verification. Failed or original-fallback pages cost $0.</p>
            <button className="primary-button wide" type="button" onClick={() => void confirm()}>Confirm and clean</button>
          </section>
        </div>
      ) : null}

      {phase === "complete" && job ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={reset}>
          <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={reset} aria-label="Close result"><X size={20} /></button>
            <CheckCircle className="success-icon" size={46} weight="fill" />
            <p className="eyebrow">Verified result</p>
            <h2 id="result-title">Your clean file is ready</h2>
            <p className="modal-copy">Final charge: {formatUsd(job.chargedCents || 58)}. The private download expires after 7 days.</p>
            <button className="primary-button wide" type="button" onClick={reset}>Start another job</button>
          </section>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={reset}>
          <section className="result-modal" role="alertdialog" aria-modal="true" aria-labelledby="error-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={reset} aria-label="Close error"><X size={20} /></button>
            <WarningCircle className="error-icon" size={46} weight="fill" />
            <h2 id="error-title">We could not start that job</h2>
            <p className="modal-copy">{error}</p>
            <button className="secondary-button wide" type="button" onClick={reset}>Try another file</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
