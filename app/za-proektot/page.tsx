import { Card, CardHeader } from "@/components/ui";
import { t } from "@/lib/strings";

export const metadata = { title: `${t.about.title} · ${t.appName}` };

/** Architecture diagram as a simple, dependency-free CSS layout. */
function ArchitectureDiagram() {
  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="rounded-xl border-2 border-slate-300 bg-slate-50 px-6 py-3 text-center">
        <p className="font-semibold text-slate-900">Прелистувач</p>
        <p className="text-xs text-slate-500">React UI · Recharts</p>
      </div>
      <span className="text-slate-400 text-xl leading-none">↓ ↑</span>
      <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 px-6 py-3 text-center">
        <p className="font-semibold text-indigo-900">Next.js сервер</p>
        <p className="text-xs text-indigo-700">
          API рути · мерење на време околу повикот кон драјверот
        </p>
      </div>
      <span className="text-slate-400 text-xl leading-none">↓ ↑</span>
      <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
        <div className="rounded-xl border-2 border-indigo-400 bg-white px-4 py-3 text-center">
          <p className="font-semibold text-indigo-700">SAP HANA Cloud</p>
          <p className="text-xs text-slate-500">in-memory · колонска</p>
        </div>
        <div className="rounded-xl border-2 border-teal-400 bg-white px-4 py-3 text-center">
          <p className="font-semibold text-teal-700">PostgreSQL</p>
          <p className="text-xs text-slate-500">на диск · редова</p>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-center text-xs text-slate-500 max-w-lg">
        Идентична шема и идентични податоци во двете бази (seed скрипта со
        @faker-js/faker, детерминистички seed)
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t.about.title}
        </h1>
        <p className="text-slate-500 mt-1">{t.about.subtitle}</p>
      </div>

      <Card>
        <CardHeader title={t.about.architectureTitle} />
        <div className="p-5">
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            {t.about.architectureText}
          </p>
          <ArchitectureDiagram />
        </div>
      </Card>

      <Card>
        <CardHeader title={t.about.methodologyTitle} />
        <ol className="p-5 pt-3 space-y-3">
          {t.about.methodologySteps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
              <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title={t.about.schemaTitle} />
        <div className="p-5 pt-3 space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>{t.about.schemaText}</p>
          <p>{t.about.dataText}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title={t.about.limitationsTitle} />
        <ul className="p-5 pt-3 space-y-2.5">
          {t.about.limitations.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-600 leading-relaxed">
              <span className="shrink-0 text-amber-500 font-bold">!</span>
              {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title={t.about.stackTitle} />
        <dl className="p-5 pt-3 grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {t.about.stack.map(([name, desc]) => (
            <div key={name} className="text-sm">
              <dt className="font-semibold text-slate-900">{name}</dt>
              <dd className="text-slate-500">{desc}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
