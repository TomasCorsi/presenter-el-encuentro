import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";

import { Page, PageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useBible } from "@/features/bible/bible-context";
import { BibleImportDialog } from "@/features/bible/components/bible-import-dialog";
import { BibleVersionList } from "@/features/bible/components/bible-version-list";

const TITLE = "Bible — Plataforma de presentación en vivo";
const DESCRIPTION =
  "Biblias instaladas en el dispositivo: importa archivos JSON y proyéctalos sin conexión.";

export const Route = createFileRoute("/_app/bible/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BiblePage,
});

function BiblePage() {
  const { versions, hasLoaded, error, clearError, parseFile, installBible, removeBible } = useBible();
  const [importOpen, setImportOpen] = useState(false);

  const importButton = (
    <Button size="sm" onClick={() => setImportOpen(true)}>
      <Plus aria-hidden="true" />
      Importar Biblia
    </Button>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Contenido"
        title="Bible"
        description="Biblias instaladas en este dispositivo. Funcionan sin conexión."
        actions={importButton}
      />

      {error ? (
        <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Cerrar</Button>
        </div>
      ) : null}

      {!hasLoaded ? (
        <p role="status" className="text-sm text-muted-foreground">Cargando Biblias instaladas…</p>
      ) : versions.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No hay Biblias instaladas"
          description="Importa un archivo .json para navegar libros, capítulos y versículos sin conexión."
          actions={importButton}
        />
      ) : (
        <section aria-labelledby="installed-title">
          <h2 id="installed-title" className="mb-3 text-base font-semibold text-foreground">
            Biblias instaladas
          </h2>
          <BibleVersionList versions={versions} onDelete={removeBible} />
        </section>
      )}

      <BibleImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onParse={parseFile}
        onConfirm={async (bible) => { await installBible(bible); }}
      />
    </Page>
  );
}
