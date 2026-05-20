import { Hero } from "@/components/hero";
import { Roadmap } from "@/components/roadmap";
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
          <a href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-white">A</div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-white">AEC Platform</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">vietnam construction OS</span>
            </div>
          </a>
          <nav className="hidden gap-6 text-sm text-slate-300 sm:flex">
            <a href="#products" className="hover:text-white">Sản phẩm</a>
            <a href="#roadmap" className="hover:text-white">Roadmap</a>
            <a href="#legal" className="hover:text-white">Pháp lý VN</a>
            <a href="#pricing" className="hover:text-white">Giá</a>
            <a href="https://app.aecplatform.vn" className="rounded-md bg-blue-600 px-3 py-1 text-white hover:bg-blue-700">Vào ứng dụng</a>
          </nav>
        </div>
      </header>

      <Hero />
      <div id="products"><Modules /></div>
      <div id="roadmap"><Roadmap /></div>
      <div id="compare"><Compare /></div>
      <div id="legal"><VnStack /></div>
      <div id="pricing"><Pricing /></div>
      <Footer />
    </>
  );
}
