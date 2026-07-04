import { Suspense, lazy, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { api, useCases, useInvalidateCase, type CaseItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/TopBar";
import { NavRail, type NavKey } from "@/components/NavRail";
import { CasePicker } from "@/components/CasePicker";
import { EvidenceUpload } from "@/components/EvidenceUpload";
import { InvestigationConsole } from "@/components/InvestigationConsole";
import { TimelinePanel } from "@/components/TimelinePanel";
import { TheTurnPanel } from "@/components/TheTurnPanel";
import { EvidenceDrawer } from "@/components/EvidenceDrawer";
import { Aurora } from "@/components/theme/Aurora";

// The Cytoscape bundle is heavy - load it only when the graph tab is opened.
const KnowledgeGraphPanel = lazy(() =>
  import("@/components/KnowledgeGraphPanel").then((m) => ({ default: m.KnowledgeGraphPanel }))
);

function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-accent" /> {label}
    </div>
  );
}

/** Placeholder for data tabs when the active upload case has not been ingested. */
function NeedIngest({ onGo }: { onGo: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center animate-scale-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-[#EC4899]/15 text-accent-hi">
        <Upload className="h-6 w-6" />
      </div>
      <div className="text-sm text-ink">This case has no evidence in the graph yet.</div>
      <div className="max-w-sm text-2xs text-faint">
        Upload and ingest evidence to populate the investigation, graph, and timeline.
      </div>
      <Button size="sm" variant="subtle" onClick={onGo}>
        Go to Evidence
      </Button>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<"picker" | "workspace">("picker");
  const [nav, setNav] = useState<NavKey>("investigation");
  const [enteredId, setEnteredId] = useState<string | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const casesQ = useCases();
  const invalidate = useInvalidateCase();
  const cases = casesQ.data?.cases ?? [];
  const materializedId = casesQ.data?.materialized_case_id ?? "demo";
  const snapshotAvailable = casesQ.data?.snapshot_available ?? false;
  const enteredCase = cases.find((c) => c.id === enteredId);
  const materialized = !!enteredCase && materializedId === enteredCase.id;

  async function openDemo() {
    setBusy("demo");
    setError(null);
    try {
      await api.openCase("demo");
      await casesQ.refetch();
      invalidate();
      setEnteredId("demo");
      setNav("investigation");
      setView("workspace");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function openCase(id: string) {
    const c = cases.find((x) => x.id === id);
    if (c?.kind === "demo") return openDemo();
    setBusy(id);
    setError(null);
    try {
      await api.openCase(id);
      await casesQ.refetch();
      invalidate();
      setEnteredId(id);
      setNav(c?.materialized ? "investigation" : "evidence");
      setView("workspace");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function newInvestigation(name: string) {
    setBusy("new");
    setError(null);
    try {
      const { case: c } = await api.createCase(name);
      await casesQ.refetch();
      setEnteredId(c.id);
      setNav("evidence");
      setView("workspace");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function goToPicker() {
    casesQ.refetch();
    setView("picker");
  }

  async function deleteCase(id: string) {
    setBusy(id);
    setError(null);
    try {
      await api.deleteCase(id);
      if (enteredId === id) setEnteredId(null);
      await casesQ.refetch();
      invalidate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (view === "picker" || !enteredCase) {
    return (
      <div className="flex h-full flex-col">
        <Aurora />
        <CasePicker
          cases={cases}
          snapshotAvailable={snapshotAvailable}
          busy={busy}
          error={error}
          onOpenDemo={openDemo}
          onOpenCase={openCase}
          onNewInvestigation={newInvestigation}
          onDeleteCase={deleteCase}
        />
      </div>
    );
  }

  const gated = (node: React.ReactNode) =>
    materialized ? node : <NeedIngest onGo={() => setNav("evidence")} />;

  return (
    <div className="flex h-full flex-col">
      <Aurora />
      <TopBar activeCase={enteredCase} />
      <div className="flex min-h-0 flex-1">
        <NavRail nav={nav} onNav={setNav} onCases={goToPicker} />

        <main className="flex min-h-0 flex-1 flex-col">
          {nav === "investigation" && (
            <div className="min-h-0 flex-1 overflow-auto p-4 animate-slide-up-fade">
              {gated(
                <InvestigationConsole
                  onOpenEvidence={setEvidenceFile}
                  isDemo={enteredCase.kind === "demo"}
                />
              )}
            </div>
          )}
          {nav === "graph" && (
            <div className="flex min-h-0 flex-1 flex-col p-4 animate-slide-up-fade">
              {gated(
                <Suspense fallback={<Loading label="loading graph engine..." />}>
                  <KnowledgeGraphPanel onOpenEvidence={setEvidenceFile} />
                </Suspense>
              )}
            </div>
          )}
          {nav === "timeline" && (
            <div className="flex min-h-0 flex-1 flex-col p-4 animate-slide-up-fade">
              {gated(
                <TimelinePanel
                  onOpenEvidence={setEvidenceFile}
                  isDemo={enteredCase.kind === "demo"}
                />
              )}
            </div>
          )}
          {nav === "turn" && (
            <div className="flex min-h-0 flex-1 flex-col p-4 animate-slide-up-fade">
              {gated(
                <TheTurnPanel
                  caseItem={enteredCase as CaseItem}
                  onOpenEvidence={setEvidenceFile}
                />
              )}
            </div>
          )}
          {nav === "evidence" && (
            <div className="min-h-0 flex-1 overflow-auto p-4 animate-slide-up-fade">
              <EvidenceUpload
                activeCase={enteredCase as CaseItem}
                onCaseChanged={() => {
                  casesQ.refetch();
                  invalidate();
                }}
                onOpenInvestigation={async () => {
                  await casesQ.refetch();
                  invalidate();
                  setNav("investigation");
                }}
                onOpenEvidence={setEvidenceFile}
              />
            </div>
          )}
        </main>
      </div>

      <EvidenceDrawer filename={evidenceFile} onClose={() => setEvidenceFile(null)} />
    </div>
  );
}
