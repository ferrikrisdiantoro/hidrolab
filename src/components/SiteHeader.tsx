import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-ink">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-6 py-2.5">
        <Link href="/" className="plain flex items-baseline gap-2.5">
          <span className="label text-[0.98rem] font-bold tracking-tight text-ink">
            HidroLab
          </span>
          <span className="stencil">laboratorium hidraulika interaktif</span>
        </Link>
        <span className="stencil">
          berkas gambar · satuan SI · purwarupa
        </span>
      </div>
    </header>
  );
}
