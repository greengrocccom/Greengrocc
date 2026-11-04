import { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, Share2, X } from 'lucide-react';
import apiClient from '../../api/client';
import { currentExportScope, getExportSources } from '../../utils/adminExportStore';
import { captureVisibleTables, collectDatasetRows } from '../../utils/collectExport';
import { createCsv, downloadExport, exportFilename, readableLabel } from '../../utils/exportData';
import { BTN, BTN_PRIMARY, INPUT } from '../../utils/ui';

export default function AdminDataExport({ contentRef }) {
  const [dialog, setDialog] = useState(null);
  const [choice, setChoice] = useState('view');
  const [format, setFormat] = useState('csv');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(null);
  const [notice, setNotice] = useState('');
  const modal = useRef(null);
  const controller = useRef(null);

  useEffect(() => {
    if (dialog) modal.current?.showModal();
    return () => { controller.current?.abort(); };
  }, [dialog]);

  const close = () => { controller.current?.abort(); setDialog(null); setBusy(false); setReady(null); };
  const open = () => {
    const root = contentRef.current;
    const title = root?.querySelector('h1')?.textContent.trim() || readableLabel(window.location.pathname.split('/').filter(Boolean).join(' ')) || 'Dashboard';
    const tables = captureVisibleTables(root);
    const options = getExportSources(currentExportScope()).flatMap(source => source.datasets.map((dataset, index) => ({ id: `${source.key}|${index}`, source, dataset })));
    setDialog({ title, tables, options });
    setChoice(tables.length ? 'view' : options[0]?.id || 'view');
    setReady(null); setError(''); setNotice(''); setProgress('');
  };

  const prepare = async download => {
    setError(''); setNotice(''); setReady(null); setBusy(true);
    const operation = new AbortController();
    controller.current = operation;
    try {
      let sections;
      let scope;
      if (choice === 'view') {
        sections = dialog.tables;
        scope = 'Current view';
      } else {
        const selected = choice === 'all' ? dialog.options : dialog.options.filter(option => option.id === choice);
        sections = [];
        scope = 'Saved records';
        for (const option of selected) {
          setProgress(`Loading ${option.dataset.title}…`);
          const rows = await collectDatasetRows(option.source, option.dataset, async (url, config) => {
            const response = await apiClient.get(url, { ...config, live: false, exportCapture: false });
            return response.data;
          }, { signal: operation.signal, onProgress: (count, total) => setProgress(`Loaded ${count}${total ? ` of ${total}` : ''} records`) });
          if (rows.length) sections.push({ title: option.dataset.title, rows });
        }
      }
      if (!sections.length || !sections.some(section => section.rows.length)) throw new Error('No saved records are available to export in this selection.');
      operation.signal.throwIfAborted();
      setProgress(format === 'pdf' ? 'Creating readable PDF…' : 'Creating CSV…');
      const generatedAt = new Date();
      let blob;
      if (format === 'pdf') {
        const { createPdfBlob } = await import('../../utils/exportPdf');
        blob = await createPdfBlob({ title: dialog.title, sections, scope, generatedAt });
      } else {
        // Dataset column retains every section in a single rectangular CSV.
        const rows = sections.length === 1 ? sections[0].rows : sections.flatMap(section => section.rows.map(row => ({ Dataset: section.title, ...row })));
        blob = new Blob([createCsv(rows)], { type: 'text/csv;charset=utf-8' });
      }
      operation.signal.throwIfAborted();
      const name = exportFilename(dialog.title, format, generatedAt);
      setReady({ blob, name, count: sections.reduce((sum, section) => sum + section.rows.length, 0) });
      if (download) { downloadExport(blob, name); setNotice('File downloaded. You can also share it below.'); }
    } catch (err) {
      if (!operation.signal.aborted) setError(err.response?.data?.message || err.message || 'Could not export records. Please retry.');
    } finally {
      if (!operation.signal.aborted) setBusy(false);
    }
  };

  const share = async () => {
    const file = new File([ready.blob], ready.name, { type: ready.blob.type });
    if (!navigator.canShare?.({ files: [file] })) {
      downloadExport(ready.blob, ready.name);
      setNotice('File sharing is unavailable in this browser. File downloaded so you can attach it to a message.');
      return;
    }
    try { await navigator.share({ files: [file], title: dialog.title }); }
    catch (err) {
      if (err.name !== 'AbortError') { downloadExport(ready.blob, ready.name); setNotice('The share sheet could not open. File downloaded so you can share it manually.'); }
    }
  };

  return <>
    <button type="button" onClick={open} aria-label="Export this page" title="Export this page as CSV or PDF" className={`${BTN} shrink-0 gap-1.5 text-xs`}>
      <Download aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">Export</span>
    </button>
    {dialog ? <dialog ref={modal} onCancel={close} style={{ width: 'calc(100vw - 2rem)', maxWidth: '32rem' }} className="fixed inset-0 m-auto max-h-[90dvh] overflow-y-auto rounded-2xl border-0 bg-white p-5 text-slate-800 shadow-2xl backdrop:bg-slate-900/40">
      <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Export &amp; share</h2><p className="mt-1 text-sm text-slate-500">{dialog.title}</p></div><button type="button" onClick={close} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close export"><X className="h-5 w-5" /></button></div>
      <label className="mb-1 block text-sm font-semibold" htmlFor="admin-export-data">Data to export</label>
      <select id="admin-export-data" className={INPUT} disabled={busy} value={choice} onChange={event => { setChoice(event.target.value); setReady(null); setNotice(''); }}>
        {dialog.tables.length ? <option value="view">Current view · {dialog.tables.reduce((sum, table) => sum + table.rows.length, 0)} visible rows</option> : null}
        {dialog.options.length > 1 ? <option value="all">All datasets on this page</option> : null}
        {dialog.options.map(option => <option key={option.id} value={option.id}>{option.dataset.title}{option.source.snapshot ? ' · Saved record' : option.dataset.summary ? ' · Summary' : ' · All matching records'}</option>)}
        {!dialog.tables.length && !dialog.options.length ? <option value="view">No saved data loaded yet</option> : null}
      </select>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">Current view exports the rows currently shown. Saved datasets include all available pages for the selected filters.</p>
      <fieldset disabled={busy} className="my-4 flex gap-3"><legend className="mb-2 text-sm font-semibold">File format</legend>{[['csv', 'CSV', FileSpreadsheet], ['pdf', 'PDF', FileText]].map(([id, label, Icon]) => <label key={id} className={`flex flex-1 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-medium ${format === id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200'}`}><input type="radio" name="admin-export-format" value={id} checked={format === id} onChange={() => { setFormat(id); setReady(null); setNotice(''); }} /><Icon className="h-4 w-4" />{label}</label>)}</fieldset>
      {busy ? <p role="status" className="my-3 flex items-center gap-2 text-sm text-emerald-700"><Loader2 className="h-4 w-4 animate-spin" />{progress || 'Preparing export…'}</p> : null}
      {error ? <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="my-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {ready ? <div className="my-3 rounded-xl border border-slate-200 p-3"><p className="break-all text-sm font-semibold">{ready.name}</p><p className="mt-1 text-xs text-slate-500">{ready.count} records · {(ready.blob.size / 1024).toFixed(1)} KB</p><div className="mt-3 flex gap-2"><button type="button" className={BTN_PRIMARY} onClick={share}><Share2 className="mr-1.5 h-4 w-4" />Share file</button><button type="button" className={BTN} onClick={() => downloadExport(ready.blob, ready.name)}><Download className="mr-1.5 h-4 w-4" />Download</button></div></div> : <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy || (!dialog.tables.length && !dialog.options.length)} className={`${BTN} disabled:opacity-40`} onClick={() => prepare(false)}><Share2 className="mr-1.5 h-4 w-4" />Prepare to share</button><button type="button" disabled={busy || (!dialog.tables.length && !dialog.options.length)} className={`${BTN_PRIMARY} disabled:opacity-40`} onClick={() => prepare(true)}><Download className="mr-1.5 h-4 w-4" />Download {format.toUpperCase()}</button></div>}
    </dialog> : null}
  </>;
}
