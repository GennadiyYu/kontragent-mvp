import SearchBar from "@/components/home/SearchBar";
import RecentChecks from "@/components/home/RecentChecks";
import FeaturesSection from "@/components/home/FeaturesSection";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-gradient-to-b from-blue-50/60 via-slate-50 to-slate-50">
      <div className="flex w-full flex-col items-center gap-4 px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          Проверка контрагентов нового поколения
        </span>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Проверьте контрагента за 10 секунд
        </h1>
        <p className="max-w-xl text-base text-slate-600">
          ИНН, ОГРН или название — получите аналитическое досье с прозрачной оценкой риска от 0 до 100 и
          рекомендациями по сотрудничеству.
        </p>
        <div className="mt-4 flex w-full justify-center">
          <SearchBar />
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-12 px-4 pb-20 sm:px-6">
        <RecentChecks />
        <FeaturesSection />
      </div>
    </div>
  );
}
