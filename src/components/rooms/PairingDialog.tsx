import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { FiLoader } from "react-icons/fi";

import { redeemPairingCode } from "../../api/clientPairing";
import { formatPairingCodeInput, normalizePairingCode, PAIRING_CODE_FORMAT_ERROR } from "../../config/pairingCode";
import { savePairedAppClientId } from "../../config/pairedAppClient";

interface PairingDialogProps {
  onClose(): void;
  onPaired(clientId: string): void;
}

export default function PairingDialog({ onClose, onPaired }: PairingDialogProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    const normalizedCode = normalizePairingCode(code);
    if (!normalizedCode) {
      setError(PAIRING_CODE_FORMAT_ERROR);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const clientId = await redeemPairingCode(normalizedCode);
      savePairedAppClientId(clientId);
      onPaired(clientId);
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "RoomFit Scan과 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
      setIsSubmitting(false);
    }
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !isSubmitting) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5 py-10">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pairing-dialog-title"
        aria-describedby="pairing-dialog-description pairing-dialog-help"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl sm:p-8"
      >
        <h2 id="pairing-dialog-title" className="text-2xl font-extrabold text-[#151515]">
          RoomFit Scan과 연동하기
        </h2>
        <p id="pairing-dialog-description" className="mt-3 text-sm font-medium leading-6 text-[#555555]">
          RoomFit Scan 앱에 표시된 연결 코드를 입력해주세요.
        </p>
        <p id="pairing-dialog-help" className="mt-1 text-sm leading-6 text-[#777777]">
          한 번 연동하면 이 브라우저에서는 다음부터 자동으로 연결됩니다.
        </p>

        <form className="mt-7" onSubmit={(event) => void submit(event)} noValidate>
          <label htmlFor="pairing-code" className="block text-sm font-bold text-[#222222]">
            연결 코드
          </label>
          <input
            ref={inputRef}
            id="pairing-code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            value={code}
            placeholder="K7X9-QP42"
            disabled={isSubmitting}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "pairing-code-error" : "pairing-dialog-help"}
            onChange={(event) => {
              setCode(formatPairingCodeInput(event.target.value));
              if (error) setError("");
            }}
            className={`mt-2 h-13 w-full rounded-md border bg-white px-4 text-lg font-extrabold uppercase tracking-[0.2em] outline-none transition-colors disabled:opacity-60 ${
              error ? "border-[#b42318]" : "border-[#d7d7d7] focus:border-[#111111]"
            }`}
          />
          {error && (
            <p id="pairing-code-error" role="alert" className="mt-2 text-xs font-semibold leading-5 text-[#b42318]">
              {error}
            </p>
          )}

          <div className="mt-7 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-full border border-[#d8d8d8] px-6 py-3 text-sm font-bold text-[#333333] transition-colors hover:bg-[#f5f5f5] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-w-28 items-center justify-center gap-2 rounded-full bg-[#111111] px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-55"
            >
              {isSubmitting && <FiLoader className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isSubmitting ? "연동 중..." : "연동하기"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
