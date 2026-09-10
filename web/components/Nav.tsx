import Link from "next/link";

export function Nav() {
  return (
    <nav className="mb-6 flex gap-4 border-b border-white/10 pb-4 text-sm">
      <Link href="/" className="text-white/70 hover:text-white">
        Projekte
      </Link>
      <Link href="/media" className="text-white/70 hover:text-white">
        Fertige Videos
      </Link>
      <Link href="/brand" className="text-white/70 hover:text-white">
        Brand
      </Link>
    </nav>
  );
}
