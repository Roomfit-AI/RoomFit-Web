import type { FormEvent } from "react";
import { useState } from "react";
import { FiCheck, FiLoader } from "react-icons/fi";

import { redeemPairingCode } from "../../api/pairing";
import { adoptBrowserClientId } from "../../config/clientScope";

/**
 * 회원가입 없이, 앱에서 발급받은 영구 페어링 코드를 입력해 이 브라우저를
 * 그 앱의 clientId로 "연결"한다. 한 번 성공하면 그 이후로는 이 코드를 다시
 * 입력할 필요 없이 이 브라우저에서 계속 그 clientId로 인식된다(코드는
 * adoptBrowserClientId 참고 — localStorage에 영구 저장).
 *
 * 연결 성공 후에는 방금 저장한 clientId로 목록을 다시 불러와야 하므로,
 * 가장 단순하고 확실한 방법으로 페이지를 새로고침한다 — 이 페이지의 여러
 * useEffect가 세션/스코프 상태를 초기 렌더 시점에만 읽어들이는 구조라, 상태만
 * 갱신하면 이미 마운트된 훅들이 예전 스코프를 계속 참조할 위험이 있다.
 */
export default function PairingCodeLinkPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLinked, setIsLinked] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMessage("코드를 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const clientId = await redeemPairingCode(trimmed);
      adoptBrowserClientId(clientId);
      setIsLinked(true);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setIsSubmitting(false);
      setErrorMessage(error instanceof Error ? error.message : "코드를 확인하지 못했습니다.");
    }
  };

  if (isLinked) {
    return (
      <div
        role="status"
        className="mb-5 flex items-center gap-2 border-l-4 border-[#16803a] bg-[#eefbf1] px-4 py-3 text-sm font-semibold text-[#16803a]"
      >
        <FiCheck className="h-4 w-4" />
        연결됐습니다. 방 목록을 새로 불러오는 중...
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="mb-5 text-sm font-bold text-[#555555] underline decoration-[#cfcfcf] underline-offset-4 hover:text-[#111111]"
      >
        다른 기기에서 올린 방이 있나요? 코드로 연결하기
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="mb-5 rounded-lg border border-[#e5e5e5] bg-white p-5"
    >
      <p className="text-sm font-bold text-[#151515]">앱에서 받은 코드 입력</p>
      <p className="mt-1 text-xs font-medium text-[#777777]">
        앱의 "컴퓨터에서 보기"에 표시된 코드를 입력하면, 이 브라우저에서 계속 내 방을 볼 수 있어요.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="K7X9-QP42"
          disabled={isSubmitting}
          className="h-11 min-w-0 flex-1 rounded-md border border-[#d7d7d7] bg-white px-4 text-sm font-bold uppercase tracking-widest outline-none focus:border-[#111111] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-6 text-sm font-bold text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {isSubmitting && <FiLoader className="h-4 w-4 animate-spin" />}
          {isSubmitting ? "확인 중..." : "연결하기"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setErrorMessage("");
            setCode("");
          }}
          disabled={isSubmitting}
          className="h-11 rounded-full border border-[#d8d8d8] px-5 text-sm font-bold text-[#333333] transition-colors hover:bg-[#f5f5f5] disabled:opacity-50"
        >
          취소
        </button>
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 text-xs font-semibold text-[#b42318]">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
