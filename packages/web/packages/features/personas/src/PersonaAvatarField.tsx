"use client";
import { useEffect, useRef, useState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@agentic-toolkit/ui/components/avatar";
import { Button } from "@agentic-toolkit/ui/components/button";
import { authedJson } from "@agentic-toolkit/auth/client";

/**
 * Persona avatar upload. Drives the existing presigned R2 flow:
 *   POST /api/storage/uploads → PUT bytes straight to R2 → POST …/complete,
 * then reports the ready attachment id up so it saves on the persona
 * (`avatar_attachment_id`). The preview resolves a short-lived presigned GET.
 */
export function PersonaAvatarField({
  personaId,
  value,
  onChange,
}: {
  personaId: string;
  value: string | null;
  onChange: (attachmentId: string | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    authedJson<{ url: string }>(`/api/storage/downloads/${value}`)
      .then((r) => {
        if (!cancelled) setPreviewUrl(r.url);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadAvatar(personaId, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        {previewUrl ? <AvatarImage src={previewUrl} alt="" /> : null}
        <AvatarFallback>
          <ImageIcon size={20} aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={14} aria-hidden />
            {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </Button>
          {value && !uploading && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        {error && <span className="text-xs text-apt-red">{error}</span>}
      </div>
    </div>
  );
}

type UploadInit = {
  attachment: { id: string };
  uploadUrl?: string;
  deduplicated?: boolean;
};

/** Init → PUT to R2 → complete. Returns the ready attachment id. */
async function uploadAvatar(personaId: string, file: File): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const init = await authedJson<UploadInit>("/api/storage/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      contentType,
      ownerType: "persona",
      // Always a real saved persona id (the editor only mounts this field for an
      // existing persona), so the public avatar read can scope to ownerId=persona.id.
      ownerId: personaId,
      sizeBytes: file.size,
    }),
  });
  // A dedup hit returns the existing ready attachment with no uploadUrl — skip the PUT.
  if (init.uploadUrl) {
    const put = await fetch(init.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
    await authedJson(`/api/storage/uploads/${init.attachment.id}/complete`, { method: "POST" });
  }
  return init.attachment.id;
}
