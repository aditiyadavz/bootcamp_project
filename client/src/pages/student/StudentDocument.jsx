// One document: preview, versions, upload, messages with the mentor, and history.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { EmptyState, Loading, StatusBadge, Tracker } from '../../components/Bits.jsx';
import { CommentThread, History, PdfPreview, VersionList } from '../../components/Documents.jsx';
import DropZone from '../../components/DropZone.jsx';
import Icon from '../../components/Icon.jsx';
import { useRealtime } from '../../context/Realtime.jsx';
import { useLiveData } from '../../hooks/useLiveData.js';

export default function StudentDocument() {
  const { type } = useParams();
  const { version: liveVersion } = useRealtime();
  const overview = useLiveData('/documents');
  const [details, setDetails] = useState(null);
  const [selected, setSelected] = useState(null);

  const summary = overview.data?.documents.find((document) => document.type === type);
  const documentId = summary?._id;

  useEffect(() => {
    if (!documentId) return;
    api(`/documents/${documentId}`).then(setDetails).catch(() => setDetails(null));
  }, [documentId, summary?.updatedAt, liveVersion]);

  // Show the newest version whenever a new one arrives.
  const latestNumber = summary?.latest?.number;
  useEffect(() => setSelected(latestNumber ?? null), [latestNumber]);

  if (overview.error) return <p className="notice error">{overview.error}</p>;
  if (!overview.data) return <Loading />;
  const label = overview.data.types[type];
  if (!label) return <EmptyState title="Unknown document" icon="alert" />;

  const closed = overview.data.deadline && new Date(overview.data.deadline) < new Date();
  const document = details?.document;
  const reload = () => overview.reload();

  return (
    <>
      <Link className="back-link" to="/dashboard"><Icon name="back" size={15} /> Dashboard</Link>
      <div className="page-header">
        <div>
          <h1>{label}</h1>
          <div className="chips">
            <StatusBadge status={summary?.status} />
            {summary?.similarity !== null && summary?.similarity !== undefined && <span className="chip-static">Similarity {summary.similarity}%</span>}
            {summary && <span className="chip-static">{summary.versions.length} version{summary.versions.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
        <Tracker status={summary?.status} />
      </div>

      <div className="doc-layout">
        <section className="card preview-card">
          {summary && selected ? (
            <>
              <div className="card-head">
                <h2>Preview</h2>
                <a className="button ghost small" href={`/api/documents/${summary._id}/file?view=1&version=${selected}`} target="_blank" rel="noreferrer">
                  <Icon name="eye" size={15} /> Open in new tab
                </a>
              </div>
              <PdfPreview documentId={summary._id} version={selected} />
            </>
          ) : (
            <div className="first-upload">
              <EmptyState icon="upload" title="Nothing uploaded yet">Upload a PDF to start. Your mentor is notified straight away.</EmptyState>
              {!closed && <DropZone type={type} label={label} onUploaded={reload} />}
            </div>
          )}
        </section>

        <div className="side-stack">
          {summary && summary.status !== 'Approved' && !closed && (
            <section className="card">
              <h2>Upload a new version</h2>
              <DropZone type={type} label={label} replacing onUploaded={reload} compact />
            </section>
          )}
          {summary?.status === 'Approved' && (
            <p className="notice success"><Icon name="check" size={16} /> Approved. This document is locked.</p>
          )}
          {document && (
            <>
              <section className="card">
                <h2>Messages with your mentor</h2>
                <CommentThread documentId={document._id} comments={details.comments} onSent={() => api(`/documents/${document._id}`).then(setDetails)} />
              </section>
              <section className="card">
                <h2>Versions</h2>
                <VersionList documentId={document._id} versions={document.versions} selected={selected} onSelect={setSelected} />
              </section>
              <section className="card">
                <h2>Activity</h2>
                <History entries={document.history} />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
