import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local') });

const files = [
  {
    file_path: 'components/NavBar.tsx',
    content: `"use client";
import Link from "next/link";
import { useState } from "react";

export function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 text-white">
      <p className="text-lg font-semibold">Ghostfolio</p>
      <nav className="hidden gap-6 text-sm text-white/70 md:flex">
        <Link href="#features">Features</Link>
        <Link href="#work">Work</Link>
        <Link href="#contact">Contact</Link>
      </nav>
      <button
        className="rounded-full border border-white/30 px-4 py-2 text-sm text-white md:inline-flex"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        Menu
      </button>
      {menuOpen && (
        <div className="absolute right-4 top-16 w-48 rounded-2xl border border-white/20 bg-white/90 p-4 text-sm text-slate-800 shadow-2xl">
          <Link className="block py-1" href="#features">
            Features
          </Link>
          <Link className="block py-1" href="#work">
            Work
          </Link>
          <Link className="block py-1" href="#contact">
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}
`
  },
  {
    file_path: 'components/ShowcaseGrid.tsx',
    content: `import Image from "next/image";

export function ShowcaseGrid() {
  return (
    <section className="grid gap-4 py-16 sm:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="relative overflow-hidden rounded-3xl border border-white/10">
          <Image
            src={\`/shots/\${item}.png\`}
            alt={\`Shot \${item}\`}
            width={640}
            height={480}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/80 p-6 opacity-0 transition hover:opacity-100">
            <p className="text-lg font-semibold text-white">Broken overlay {item}</p>
            <p className="text-sm text-white/70">
              Hover state uses incorrect z-index so cards stay hidden behind neighbors.
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
`
  },
  {
    file_path: 'components/ContactForm.tsx',
    content: `"use client";
import { useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    // TODO: wire up API
    setTimeout(() => setStatus("done"), 1200);
  }

  return (
    <form className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
      <label className="block text-sm">
        Email
        <input
          className="mt-1 w-full rounded-2xl border border-white/20 bg-transparent px-4 py-2"
          placeholder="you@studio.com"
          type="email"
          required
        />
      </label>
      <label className="block text-sm">
        Message
        <textarea
          className="mt-1 h-32 w-full rounded-2xl border border-white/20 bg-transparent px-4 py-2"
          placeholder="What should we fix?"
          required
        />
      </label>
      <button
        className="w-full rounded-full bg-white/90 py-3 text-sm font-semibold text-slate-900 disabled:opacity-50"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending…" : "Request Fix"}
      </button>
    </form>
  );
}
`
  }
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(url, key);

  for (const file of files) {
    const { error } = await supabase.from('app_files').upsert(file);
    if (error) {
      console.error('Failed to seed', file.file_path, error.message);
    } else {
      console.log('Seeded', file.file_path);
    }
  }
}

main();
