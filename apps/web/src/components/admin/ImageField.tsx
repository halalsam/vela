'use client';

import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Button, focusRing } from '@/components/ui';
import { adminFetch, adminUpload, formatBytes, UPLOAD_MAX_MB, UPLOAD_TYPES, type AdminUpload } from '@/lib/adminApi';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';
import { input, Label } from './BlogEditor';

type Props = {
  label: string;
  hint?: string;
  value: string;
  onValue: (url: string) => void;
  /** Called with the upload's alt text when one is picked, so the editor can fill an empty alt field. */
  onAlt?: (alt: string) => void;
  placeholder?: string;
  /** Recommended size; smaller images get a warning. */
  recommend?: { width: number; height: number };
};

type Size = { width: number; height: number } | null;

/**
 * A URL field with upload, drag and drop, a preview and a picker of earlier uploads. Uploads go to S3, or to the
 * API server's disk when S3 isn't set up; either way the field ends up holding the image's URL.
 */
export function ImageField({ label, hint, value, onValue, onAlt, placeholder, recommend }: Props) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [library, setLibrary] = useState<AdminUpload[] | null>(null);
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<Size>(null);
  const [broken, setBroken] = useState(false);
  const role = useStaffRole();

  useEffect(() => {
    if (!open || library) return;
    let cancelled = false;
    adminFetch<AdminUpload[]>('/v1/admin/uploads').then(
      (items) => !cancelled && setLibrary(items),
      (caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : 'Couldn’t load uploads'),
    );
    return () => {
      cancelled = true;
    };
  }, [open, library]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await adminUpload(file);
      setLibrary((current) => (current ? [saved, ...current] : current));
      setBroken(false);
      onValue(saved.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function remove(item: AdminUpload) {
    if (!window.confirm(`Delete ${item.original_name || 'this image'}? Pages that still use it will show a broken image.`)) return;
    try {
      await adminFetch(`/v1/admin/uploads/${item.id}`, { method: 'DELETE' });
      setLibrary((current) => current?.filter((other) => other.id !== item.id) ?? null);
      if (value === item.url) onValue('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t delete the image');
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files[0]);
  };

  const small = recommend && size && (size.width < recommend.width || size.height < recommend.height);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id}>
        <Label hint={hint}>{label}</Label>
      </label>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('flex flex-col gap-3 rounded-button border border-dashed p-3 transition-colors', dragging ? 'border-accent bg-accent-tint' : 'border-line')}
      >
        <div className="flex gap-3">
          <div className="flex h-[72px] w-[112px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-surface-3">
            {value && !broken ? (
              // eslint-disable-next-line @next/next/no-img-element -- preview of an uploaded or pasted URL
              <img
                key={value}
                src={value}
                alt=""
                className="h-full w-full object-cover"
                onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                onError={() => {
                  setBroken(true);
                  setSize(null);
                }}
              />
            ) : (
              <span className={cn(type.caption, 'px-2 text-center text-fg-quaternary')}>{broken ? 'Didn’t load' : busy ? 'Uploading…' : 'No image'}</span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              id={id}
              value={value}
              onChange={(event) => {
                setBroken(false);
                setSize(null);
                onValue(event.target.value);
              }}
              placeholder={placeholder ?? 'https://… or drop an image here'}
              className={cn(input, 'h-10 text-[14px]')}
              dir="ltr"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
                {busy ? 'Uploading…' : 'Upload'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
                {open ? 'Close library' : 'Library'}
              </Button>
              {value ? (
                <Button size="sm" variant="ghost" onClick={() => onValue('')}>
                  Clear
                </Button>
              ) : null}
              {size ? (
                <span className={cn(type.caption, small ? 'text-warning' : 'text-fg-tertiary')}>
                  {size.width}×{size.height}
                  {small ? ` · smaller than ${recommend!.width}×${recommend!.height}` : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={UPLOAD_TYPES.join(',')}
          className="hidden"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <p className={cn(type.caption, 'text-fg-quaternary')}>JPG, PNG, WebP, GIF or AVIF, up to {UPLOAD_MAX_MB} MB. Drop a file here to upload.</p>
      </div>
      {error ? (
        <p role="alert" className={cn(type.caption, 'text-danger')}>
          {error}
        </p>
      ) : null}
      {open ? (
        <div className="rounded-button border border-line bg-surface-1 p-3">
          {!library ? (
            <p className={cn(type.caption, 'text-fg-tertiary')}>Loading…</p>
          ) : library.length === 0 ? (
            <p className={cn(type.caption, 'text-fg-tertiary')}>No uploads yet.</p>
          ) : (
            <ul className="grid max-h-80 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {library.map((item) => (
                <li key={item.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      onValue(item.url);
                      if (item.alt) onAlt?.(item.alt);
                      setBroken(false);
                      setOpen(false);
                    }}
                    className={cn('flex w-full flex-col gap-1 rounded-[6px] text-start', value === item.url ? 'ring-2 ring-accent' : '', focusRing)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of uploaded files */}
                    <img src={item.url} alt={item.alt} loading="lazy" className="aspect-[4/3] w-full rounded-[6px] bg-surface-3 object-cover" />
                    <span className={cn(type.caption, 'truncate text-fg-secondary')}>{item.original_name || 'image'}</span>
                    <span className={cn(type.caption, 'text-fg-quaternary')}>
                      {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
                      {formatBytes(item.bytes)} · {item.driver === 's3' ? 'S3' : item.driver === 'disk' ? 'server' : 'demo'}
                    </span>
                  </button>
                  {role === 'admin' ? (
                    <button
                      type="button"
                      onClick={() => void remove(item)}
                      aria-label={`Delete ${item.original_name || 'image'}`}
                      className={cn('absolute end-1 top-1 hidden h-6 w-6 items-center justify-center rounded-pill bg-black/70 text-[12px] text-white group-hover:flex focus:flex', focusRing)}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
