export interface ExportFile {
  blob: Blob;
  name: string;
}

export const PDF_TYPE = 'application/pdf';
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const toFile = (f: ExportFile) => new File([f.blob], f.name, { type: f.blob.type });

/** ¿El navegador puede abrir la hoja de compartir del sistema con este archivo? (iPhone/iPad/Android/Safari) */
export function canShareFile(f: ExportFile): boolean {
  try {
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [toFile(f)] });
  } catch {
    return false;
  }
}

/**
 * Abre la hoja de compartir nativa (WhatsApp, Telegram, Correo…).
 * Debe llamarse directamente desde un toque del usuario: iOS exige un gesto reciente.
 * Devuelve false si el usuario canceló.
 */
export async function shareFile(f: ExportFile, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [toFile(f)], title });
    return true;
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return false;
    throw err;
  }
}

export function downloadFile(f: ExportFile) {
  const url = URL.createObjectURL(f.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
