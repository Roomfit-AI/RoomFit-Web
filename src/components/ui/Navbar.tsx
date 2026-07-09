import { useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const buttonLabel = isHome ? "시작하기" : "다음";
  const nextPath = isHome ? "/rooms" : "/manage-furniture";

  return (
    <nav className="h-19 border-b border-[#e8e8e8] bg-[#fbfbfb]">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold tracking-[0.02em] text-[#181818] sm:text-2xl">
          ROOMAI
        </h2>

        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate(nextPath)}
            className="hidden px-7 py-2.5 sm:inline-flex"
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </nav>
  );
}
