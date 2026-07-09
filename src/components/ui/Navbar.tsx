import Button from "./Button";

export default function Navbar() {
  return (
    <nav className="h-[76px] border-b border-[#e8e8e8] bg-[#fbfbfb]">
      <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold tracking-[0.02em] text-[#181818] sm:text-2xl">ROOMAI</h2>

        <div className="flex items-center gap-4">
          <Button onClick={() => (window.location.href = "/rooms")} className="hidden px-7 py-2.5 sm:inline-flex">
            시작하기
          </Button>
          
        </div>
      </div>
    </nav>
  );
}
