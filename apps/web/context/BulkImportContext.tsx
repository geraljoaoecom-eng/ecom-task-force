'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { adminLibraryApi } from '@/lib/api';
import { getApiErrorMessage, isLibraryDuplicateError, LIBRARY_DUPLICATE_MESSAGE } from '@/lib/library-messages';
import {
  clearBulkImportJob,
  loadBulkImportJob,
  saveBulkImportJob,
  type BulkResult,
  type PersistedBulkImportJob,
} from '@/lib/bulk-import-storage';

export type { BulkResult };

interface BulkImportContextValue {
  running: boolean;
  visible: boolean;
  progress: { current: number; total: number };
  results: BulkResult[];
  expanded: boolean;
  startBulkImport: (urls: string[]) => Promise<boolean>;
  setExpanded: (value: boolean) => void;
  dismiss: () => void;
}

const BulkImportContext = createContext<BulkImportContextValue | null>(null);

function jobSnapshot(
  urls: string[],
  results: BulkResult[],
  nextIndex: number,
  running: boolean,
  visible: boolean,
  expanded: boolean,
  startedAt: number
): PersistedBulkImportJob {
  return { urls, results, nextIndex, running, visible, expanded, startedAt };
}

export function BulkImportProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BulkResult[]>([]);
  const [expanded, setExpandedState] = useState(true);
  const runningRef = useRef(false);
  const urlsRef = useRef<string[]>([]);
  const resultsRef = useRef<BulkResult[]>([]);
  const startedAtRef = useRef(Date.now());
  const expandedRef = useRef(true);
  const resumedRef = useRef(false);

  const persist = useCallback(
    (patch: Partial<PersistedBulkImportJob> & { urls?: string[]; results?: BulkResult[]; nextIndex?: number }) => {
      saveBulkImportJob(
        jobSnapshot(
          patch.urls ?? urlsRef.current,
          patch.results ?? resultsRef.current,
          patch.nextIndex ?? resultsRef.current.length,
          patch.running ?? runningRef.current,
          patch.visible ?? true,
          patch.expanded ?? expandedRef.current,
          patch.startedAt ?? startedAtRef.current
        )
      );
    },
    []
  );

  const setExpanded = useCallback(
    (value: boolean) => {
      expandedRef.current = value;
      setExpandedState(value);
      persist({ expanded: value, visible: true });
    },
    [persist]
  );

  const runImportLoop = useCallback(
    async (urls: string[], startIndex: number, existingResults: BulkResult[]): Promise<number> => {
      if (runningRef.current) return 0;

      runningRef.current = true;
      urlsRef.current = urls;
      resultsRef.current = existingResults;
      setRunning(true);
      setVisible(true);
      setResults(existingResults);
      setProgress({ current: startIndex, total: urls.length });
      persist({ urls, results: existingResults, nextIndex: startIndex, running: true, visible: true });

      const localResults = [...existingResults];
      let successCount = localResults.filter((r) => r.status === 'success').length;

      for (let i = startIndex; i < urls.length; i++) {
        const currentUrl = urls[i];
        setProgress({ current: i + 1, total: urls.length });
        persist({ nextIndex: i, results: localResults, running: true });

        try {
          const analyzed = await adminLibraryApi.analyze(currentUrl);
          const draftData = analyzed.draft;
          await adminLibraryApi.import({
            ...draftData,
            pages: (draftData.pages || []).filter(Boolean),
          });
          localResults.push({ url: currentUrl, status: 'success', name: draftData.name });
          successCount++;
          resultsRef.current = localResults;
          setResults([...localResults]);
          persist({ nextIndex: i + 1, results: localResults, running: true });
          window.dispatchEvent(new CustomEvent('libraries-changed'));
        } catch (err: unknown) {
          const isDuplicate = isLibraryDuplicateError(err);
          const msg = isDuplicate
            ? LIBRARY_DUPLICATE_MESSAGE
            : getApiErrorMessage(err, 'Erro desconhecido');
          if (msg.includes('504') || (err as { response?: { status?: number } })?.response?.status === 504) {
            localResults.push({
              url: currentUrl,
              status: 'error',
              message: 'Timeout — a análise demorou demasiado (tenta este link outra vez)',
            });
          } else {
            localResults.push({
              url: currentUrl,
              status: isDuplicate ? 'skipped' : 'error',
              message: msg,
            });
          }
          resultsRef.current = localResults;
          setResults([...localResults]);
          persist({ nextIndex: i + 1, results: localResults, running: true });
        }
      }

      runningRef.current = false;
      setRunning(false);
      persist({ nextIndex: urls.length, results: localResults, running: false, visible: true });
      return successCount;
    },
    [persist]
  );

  const startBulkImport = useCallback(
    async (urls: string[]): Promise<boolean> => {
      if (!urls.length || runningRef.current) return false;

      startedAtRef.current = Date.now();
      expandedRef.current = true;
      setExpandedState(true);
      setResults([]);
      resultsRef.current = [];

      const successCount = await runImportLoop(urls, 0, []);
      return successCount > 0;
    },
    [runImportLoop]
  );

  const dismiss = useCallback(() => {
    if (runningRef.current) return;
    clearBulkImportJob();
    setVisible(false);
    setResults([]);
    setProgress({ current: 0, total: 0 });
    resultsRef.current = [];
    urlsRef.current = [];
  }, []);

  // Restaurar job após refresh e retomar importação interrompida
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;

    const job = loadBulkImportJob();
    if (!job) return;

    urlsRef.current = job.urls;
    resultsRef.current = job.results;
    startedAtRef.current = job.startedAt;
    expandedRef.current = job.expanded;

    setResults(job.results);
    setProgress({
      current: Math.min(job.nextIndex, job.urls.length),
      total: job.urls.length,
    });
    setExpandedState(job.expanded);
    setVisible(job.visible);

    const needsResume = job.running && job.nextIndex < job.urls.length;
    if (needsResume) {
      void runImportLoop(job.urls, job.nextIndex, job.results);
    } else {
      setRunning(false);
      runningRef.current = false;
      if (job.running) {
        persist({ running: false, visible: job.visible, nextIndex: job.urls.length, results: job.results });
      }
    }
  }, [runImportLoop, persist]);

  return (
    <BulkImportContext.Provider
      value={{
        running,
        visible,
        progress,
        results,
        expanded,
        startBulkImport,
        setExpanded,
        dismiss,
      }}
    >
      {children}
    </BulkImportContext.Provider>
  );
}

export function useBulkImport() {
  const ctx = useContext(BulkImportContext);
  if (!ctx) throw new Error('useBulkImport must be used within BulkImportProvider');
  return ctx;
}
