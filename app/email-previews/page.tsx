import { getAuthEmailTemplates } from "@/lib/auth/email-templates";
import { getConfiguredSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export default function EmailPreviewsPage() {
  const templates = getAuthEmailTemplates();
  const siteUrl = getConfiguredSiteUrl() ?? "http://localhost:3000";

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-3">
          <p className="text-xs font-mono uppercase tracking-[0.24em] text-muted-foreground">
            auth email previews
          </p>
          <h1 className="font-heading-style text-4xl font-black lowercase tracking-tight">
            plantillas de supabase auth
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Estas vistas sirven para revisar el HTML versionado en el repo antes de pegarlo en Supabase.
            Los logos se resuelven con <span className="font-mono text-foreground">{siteUrl}</span>.
          </p>
        </header>

        <div className="space-y-8">
          {templates.map((template) => (
            <section
              key={template.id}
              className="space-y-4 rounded-3xl border border-premium bg-card p-5 shadow-premium"
            >
              <div className="space-y-1">
                <h2 className="font-heading-style text-2xl font-black lowercase">
                  {template.label}
                </h2>
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  asunto sugerido: {template.subject}
                </p>
              </div>

              <iframe
                title={template.label}
                srcDoc={template.html}
                className="h-[760px] w-full rounded-2xl border border-premium bg-white"
              />

              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  html para supabase
                </p>
                <textarea
                  readOnly
                  value={template.html}
                  className="h-72 w-full rounded-2xl border border-premium bg-background p-4 font-mono text-xs leading-relaxed"
                />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
