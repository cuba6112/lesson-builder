// Utilities for saving files in both browser and (when available) Tauri environments

const isTauri = () =>
  typeof window !== 'undefined' &&
  (Boolean(window.__TAURI_INTERNALS__) || Boolean(window.__TAURI__));

const getTauriApis = () => {
  if (!isTauri()) return {};
  const tauri = window.__TAURI__ || window.__TAURI_INTERNALS__?.tauri || {};
  return {
    dialog: tauri.dialog,
    fs: tauri.fs
  };
};

async function saveFile({ data, filename, mimeType = 'application/octet-stream', binary = false }) {
  const { dialog, fs } = getTauriApis();

  // Prefer native Tauri dialog/fs if available (when running inside desktop app with plugins)
  if (dialog?.save && fs?.writeFile) {
    const targetPath = await dialog.save({ defaultPath: filename });
    if (!targetPath) {
      return { saved: false, cancelled: true };
    }

    if (binary) {
      let bytes;
      if (data instanceof Uint8Array) {
        bytes = data;
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      } else if (data instanceof Blob) {
        bytes = new Uint8Array(await data.arrayBuffer());
      } else {
        throw new Error('Binary data must be a Uint8Array, ArrayBuffer, or Blob');
      }
      await fs.writeFile(targetPath, bytes);
    } else {
      let text;
      if (typeof data === 'string') {
        text = data;
      } else if (data instanceof Blob) {
        text = await data.text();
      } else {
        text = String(data);
      }
      await fs.writeFile(targetPath, text);
    }

    return { saved: true, path: targetPath };
  }

  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { saved: true };
}

export { isTauri, saveFile };
