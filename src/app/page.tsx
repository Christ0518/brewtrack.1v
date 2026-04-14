"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-50 via-sky-50 to-slate-100 flex items-center justify-center px-6">
      <section className="w-full max-w-2xl rounded-3xl border border-slate-200/70 bg-white/70 p-10 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] backdrop-blur">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-900">Choose your brew</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Curated spots, one click away.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-blue-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => {
              router.push("/barcelo");
            }}
          >
            Barcelo
          </button>

          <button
            className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 px-6 py-4 text-base font-semibold text-slate-900 shadow-lg shadow-amber-400/40 transition duration-300 hover:-translate-y-0.5 hover:shadow-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            onClick={() => {
              router.push("/goodcoffee");
            }}
          >
            Good Coffee
          </button>
        </div>
      </section>
    </main>
  );
}
