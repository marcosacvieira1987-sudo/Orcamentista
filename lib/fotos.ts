'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Foto } from './orc';
import { uid } from './util';

// Reduz e converte para JPEG no telemóvel antes de enviar (poupa dados móveis e tokens).
export async function paraJpeg(file: Blob, maxLado = 1600, q = 0.85): Promise<Blob> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
  const s = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', q));
}

export async function carregarFoto(sb: SupabaseClient, userId: string, orcId: string, file: File): Promise<Foto> {
  const blob = await paraJpeg(file);
  const id = uid('F');
  const path = `${userId}/${orcId}/${id}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return { id, path, nome: file.name };
}

export async function urlsAssinadas(sb: SupabaseClient, bucket: string, paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await sb.storage.from(bucket).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  (data || []).forEach((d) => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl; });
  return out;
}

export async function bytesDe(sb: SupabaseClient, bucket: string, path: string): Promise<{ bytes: Uint8Array; png: boolean } | null> {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), png: data.type === 'image/png' || /\.png$/i.test(path) };
}

// Logótipo em PNG, até ~900×360 px e menos de 1 MB.
export async function prepararLogo(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  let escala = Math.min(1, 900 / bmp.width, 360 / bmp.height);
  let blob: Blob | null = null;
  for (let k = 0; k < 6; k++) {
    const w = Math.max(1, Math.round(bmp.width * escala)), h = Math.max(1, Math.round(bmp.height * escala));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (blob && blob.size < 900_000) break;
    escala *= 0.75;
  }
  bmp.close?.();
  if (!blob || blob.size >= 900_000) throw new Error('logo_grande');
  return blob;
}
