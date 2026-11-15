// Drag and drop area that checks the file, then uploads it with a progress bar.
import { useRef, useState } from 'react';
import { formatSize, uploadFile } from '../api.js';
import Icon from './Icon.jsx';
import { useToast } from './Toast.jsx';

const MAX_BYTES = 5 * 1024 * 1024;

export default function DropZone({ type, label, replacing, onUploaded, compact }) {
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
      await onUploaded?.();
    } catch (problem) {
      setProgress(null);
      showToast(problem.message, 'error');
    }
  }

  if (progress !== null) {
    return (
      <div className={`dropzone busy ${compact ? 'compact' : ''}`}>
        <p className="file-name">Uploading {file?.name}</p>
        <div className="bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="muted small">{progress}%</p>
      </div>
    );
  }

  if (file) {
    return (
      <div className={`dropzone chosen ${compact ? 'compact' : ''}`}>
        <Icon name="file" size={22} />
        <span className="chosen-text">
          <strong className="file-name">{file.name}</strong>
          <span className="muted small">{formatSize(file.size)}</span>
        </span>
        <span className="row">
          <button className="button small" onClick={upload}><Icon name="upload" size={15} /> {replacing ? 'Upload new version' : 'Upload'}</button>
          <button className="button small ghost" onClick={clear}>Cancel</button>
        </span>
      </div>
    );
  }

  return (
    <label
      className={`dropzone ${dragging ? 'dragging' : ''} ${compact ? 'compact' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }}
    >
      <span className="drop-icon"><Icon name="upload" size={20} /></span>
      <span className="drop-text">
        <strong>{replacing ? 'Drop a new version' : 'Drop your PDF here'}</strong>
        <span className="muted small">or click to browse &middot; PDF only, up to 5 MB</span>
      </span>
      <input ref={input} className="visually-hidden" type="file" accept=".pdf,application/pdf"
        aria-label={`Choose ${label} PDF`} onChange={(event) => choose(event.target.files[0])} />
    </label>
  );
}
