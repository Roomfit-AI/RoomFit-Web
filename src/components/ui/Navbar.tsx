import { useLocation, useNavigate } from "react-router-dom";
import Button from "./Button";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const buttonLabel = isHome ? "시작하기" : "다음";
  const nextPath = isHome ? "/rooms" : "/manage-furniture";
  const goNext = () => {
    if (location.pathname === "/rooms" && !localStorage.getItem("roomfit:selectedRoomId")) {
      localStorage.setItem("roomfit:selectedRoomId", "studio-1r-sample");
      localStorage.setItem("roomfit:selectedRoomTitle", "오픈형 원룸");
      localStorage.setItem("roomfit:selectedRoomType", "원룸");
      localStorage.setItem("roomfit:selectedRoomSize", "6평");
      localStorage.removeItem("roomfit:selectedRoomLayout");
    }

    navigate(nextPath);
  };

  return (
    <nav className="h-19 border-b border-[#e8e8e8] bg-[#fbfbfb]">
      <div className="flex px-10 h-full items-center justify-between">
        <h2 className="text-xl font-bold tracking-[0.02em] text-[#181818] sm:text-2xl">
          ROOMAI
        </h2>

        <div className="flex items-center gap-4">
          <Button
            onClick={goNext}
            className="hidden px-7 py-2.5 sm:inline-flex"
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    </nav>
  );
}
