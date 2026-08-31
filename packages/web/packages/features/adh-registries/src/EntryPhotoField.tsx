'use client';

import { useCallback, useRef, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { authedJson } from '@agentic-toolkit/auth/client';
import { useResourceItemQuery } from '@agentic-toolkit/data';
import { Avatar, AvatarFallback, AvatarImage } from '@agenticdevelopertoolkit/ui/components/avatar';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';

/**
 * The listing's photo, on the platform's existing presigned R2 flow:
 * `POST /api/storage/uploads` → `PUT` the bytes straight to R2 → `POST …/complete`.
 *
 * A near-copy of `PersonaAvatarField` (`features/personas`), changing exactly three values:
 * `ownerType` is `registry.entry`, `ownerId` is the entry id, and the preview's `alt` is real
 * text rather than `""` — this photo stands next to no name the way a persona avatar does, so
 * it needs its own accessible description. It is a copy rather than a generalisation of that
 * component because generalising it means changing the props of a shipped toolkit component —
 * whose prop is literally `personaId` — for its second consumer. Two copies is the fleet's
 * pattern here; when a third uploader appears, the extraction target is `@agenticdevelopertoolkit/ui`,
 * and this comment is the pointer to it.
 *
 * The id is reported UP and saved by the editor with everything else. Nothing here writes to
 * the entry: an upload that succeeded followed by a save the registrant cancelled leaves an
 * orphan attachment, which is cheap, and the alternative — writing the column on upload —
 * makes the photo the one field that ignores the Cancel button.
 */
/** The collection a presigned download URL is cached under, keyed by attachment id. */
const PHOTO_URL_CACHE_KEY = 'storage-download-url';

export function EntryPhotoField({
  entryId,
  value,
  onChange,
}: {
  entryId: string;
  value: string | null;
  onChange: (attachmentId: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const presign = useCallback(
    (id: string) => authedJson<{ url: string }>(`/api/storage/downloads/${id}`),
    [],
  );
  // Through the platform cache, keyed by the attachment: re-opening this section no longer
  // re-presigns a URL the browser asked for a moment ago, and the photo is on screen with the
  // rest of the form instead of a beat later.
  //
  // The cache can OUTLIVE the URL, and this used to claim the opposite. The server presigns a
  // GET for 15 minutes (`lib/storage.ts`); the platform keeps an unobserved item for thirty
  // (`RESOURCE_GC_TIME`) and only marks it stale at five. So a registrant who leaves this form
  // open, or comes back to it inside the half hour, is repainted from a URL that expired ten
  // minutes ago — instantly, because that is what the cache is for. The revalidation behind it
  // fixes the URL, but the broken image is on screen first, and neither of the two numbers is
  // this component's to change. `onLoadingStatusChange` below is the recovery: the image itself
  // is the only thing that knows the URL stopped working.
  //
  // `reportErrors: false` keeps the old behaviour exactly: a photo that will not resolve is a
  // missing photo, not an incident to report — the usual cause is a deployment with no object
  // store, which the registrant cannot fix. The error is likewise not rendered; `AvatarImage`
  // simply falls through to the icon.
  const { item, reload } = useResourceItemQuery(PHOTO_URL_CACHE_KEY, value, presign, {
    reportErrors: false,
  });
  const previewUrl = item?.url ?? null;
  // Which attachment has already had its one re-presign. ONE, and per attachment: a URL that
  // fails again after a fresh presign is a photo that is genuinely gone (a deleted object, no
  // object store at all), and retrying that on every error would be an infinite request loop
  // driven by the browser's own image loader.
  const [rePresigned, setRePresigned] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked after a failure
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      onChange(await uploadPhoto(entryId, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-16 w-16">
        {previewUrl ? (
          <AvatarImage
            src={previewUrl}
            alt="Your listing photo"
            onLoadingStatusChange={(status) => {
              if (status !== 'error' || value === null || rePresigned === value) return;
              setRePresigned(value);
              void reload().catch(() => {});
            }}
          />
        ) : null}
        <AvatarFallback>
          <ImageIcon size={20} aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Choose a photo"
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
            {uploading ? 'Uploading…' : value ? 'Replace photo' : 'Upload a photo'}
          </Button>
          {value && !uploading ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          ) : null}
        </div>
        {error ? <span className="text-xs text-apt-red">{error}</span> : null}
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
async function uploadPhoto(entryId: string, file: File): Promise<string> {
  const contentType = file.type || 'application/octet-stream';
  const init = await authedJson<UploadInit>('/api/storage/uploads', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType,
      // `ownerType` is a free `z.string().min(1).max(32)` server-side (storage.ts:17), not
      // an allowlist — this string needs no backend change, and the pair is what lets the
      // public entry route presign exactly this entry's images for an anonymous visitor.
      ownerType: 'registry.entry',
      ownerId: entryId,
      sizeBytes: file.size,
    }),
  });
  // A dedup hit returns the existing ready attachment with no uploadUrl — skip the PUT.
  if (init.uploadUrl) {
    const put = await fetch(init.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    });
    if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
    await authedJson(`/api/storage/uploads/${init.attachment.id}/complete`, { method: 'POST' });
  }
  return init.attachment.id;
}
