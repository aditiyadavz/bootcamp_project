// Drag and drop area that checks the file, then uploads it with a progress bar.
import { useRef, useState } from 'react';
import { formatSize, uploadFile } from '../api.js';
import { useToast } from './Toast.jsx';

const MAX_BYTES = 5 * 1024 * 1024;

export default function DropZone({ type, label, replacing, onUploaded }) {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null); // null means not uploading.
  const input = useRef(null);
  const showToast = useToast();

  function choose(chosen) {
    if (!chosen) return;
    // A quick check for the user. The server checks again, because browsers can be bypassed.
    if (!chosen.name.toLowerCase().endsWith('.pdf')) return showToast('Only PDF files are allowed.', 'error');
    if (chosen.size > MAX_BYTES) return showToast('That file is larger than 5 MB.', 'error');
    setFile(chosen);
  }

  function clear() {
    setFile(null);
    if (input.current) input.current.value = '';
  }

  async function upload() {
    setProgress(0);
    try {
      const { message } = await uploadFile(type, file, setProgress);
      setProgress(null);
      clear();
      showToast(message);
      await onUploaded();
    } catch (problem) {
      setProgress(null);
      showToast(problem.message, 'error');
    }
  }

  if (progress !== null) {
    return (
      <div className="dropzone uploading">
        <p>Uploading {file.name}</p>
        <div className="bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="hint">{progress}%</p>
      </div>
    );
  }

  if (file) {
    return (
      <div className="dropzone chosen">
        <p className="file-name">{file.name}</p>
        <p className="hint">{formatSize(file.size)}</p>
        <div className="row">
          <button className="button" onClick={upload}>{replacing ? 'Replace file' : 'Upload'}</button>
          <button className="button ghost" onClick={clear}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <label
      className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V5M7 10l5-5 5 5M5 19h14" />
      </svg>
      <span><strong>{replacing ? 'Drop a new PDF' : 'Drop your PDF here'}</strong> or click to browse</span>
      <span className="hint">PDF only, up to 5 MB</span>
      <input ref={input} className="visually-hidden" type="file" accept=".pdf,application/pdf"
        aria-label={`Choose ${label} PDF`} onChange={(event) => choose(event.target.files[0])} />
    </label>
  );
}
