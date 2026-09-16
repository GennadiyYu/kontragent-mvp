import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg shadow-sm group-hover:bg-blue-700 transition-colors">
            К
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold text-slate-900">Контрагент</span>
            <span className="text-[11px] text-slate-500 hidden sm:block">проверка контрагентов</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Демо-версия сервиса
          </span>
        </nav>
      </div>
    </header>
  );
}
