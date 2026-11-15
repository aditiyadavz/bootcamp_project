// Helpers for calling the Express API and for showing dates and sizes.
export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

// fetch() cannot report upload progress, so uploads use XMLHttpRequest.
export function uploadFile(type, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/documents/${type}`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let data = {};
      try {
        data = JSON.parse(request.responseText);
      } catch {
        // The message below is used when the reply is not JSON.
      }
      if (request.status < 300) resolve(data);
      else reject(new Error(data.message || 'Upload failed. Please try again.'));
    };
    request.onerror = () => reject(new Error('Upload failed. Please check your connection.'));
    const body = new FormData();
    body.append('file', file);
    request.send(body);
  });
}

const IST = { timeZone: 'Asia/Kolkata' };

export const formatDate = (value) => new Date(value).toLocaleString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatDay = (value) => new Date(value).toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short', year: 'numeric' });
export const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

export function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} d ago` : formatDay(value);
}

// Dates from a date box mean the end of that day in India.
export const endOfDay = (yyyyMmDd) => new Date(`${yyyyMmDd}T23:59:59+05:30`).toISOString();
export const toDateInput = (value) => (value ? new Date(value).toLocaleDateString('en-CA', IST) : '');

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
