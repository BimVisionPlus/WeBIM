import { Hero } from "@/components/hero";
import { Modules } from "@/components/modules";
import { Compare } from "@/components/compare";
import { VnStack } from "@/components/vn-stack";
import { Pricing } from "@/components/pricing";
import { Footer } from "@/components/footer";

export default function Page() {
  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 font-bold text-white">A</div>
            <span className="text-lg font-semibold text-white">Atlas AEC</span>
          </div>
          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex">
            <a href="#modules" className="hover:text-white">Module</a>
            <a href="#compare" className="hover:text-white">So sánh</a>
            <a href="#legal" className="hover:text-white">Pháp lý VN</a>
            <a href="#pricing" className="hover:text-white">Giá</a>
          </nav>
        </div>
      </header>

      <Hero />
      <div id="modules"><Modules /></div>
      <div id="compare"><Compare /></div>
      <div id="legal"><VnStack /></div>
      <div id="pricing"><Pricing /></div>
      <Footer />
    </>
  );
}
