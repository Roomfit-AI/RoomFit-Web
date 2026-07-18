import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import PairingDialog from "../../components/rooms/PairingDialog";
import { BROWSER_CLIENT_ID_KEY } from "../../config/clientScope";
import { PAIRED_APP_CLIENT_ID_KEY } from "../../config/pairedAppClient";
import Rooms from "../Rooms";

const BROWSER_ID = "11111111-1111-4111-8111-111111111111";
const APP_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Rooms scope UI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the unpaired Scan CTA while keeping Sample and direct-create UI visible", () => {
    installStorage();
    const html = renderToStaticMarkup(<Rooms />);

    expect(html).toContain("RoomFit Scan에서 업로드된 방");
    expect(html).toContain("RoomFit Scan과 연동하기");
    expect(html).toContain("샘플 방");
    expect(html).toContain("직접 만들기");
  });

  it("restores the paired state without displaying the App UUID", () => {
    installStorage({ [PAIRED_APP_CLIENT_ID_KEY]: APP_ID });
    const html = renderToStaticMarkup(<Rooms />);

    expect(html).toContain("다른 RoomFit Scan과 연동");
    expect(html).toContain("연동 해제");
    expect(html).not.toContain(APP_ID);
  });

  it("renders an accessible pairing dialog contract", () => {
    installStorage();
    const html = renderToStaticMarkup(<PairingDialog onClose={() => undefined} onPaired={() => undefined} />);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('placeholder="K7X9-QP42"');
    expect(html).toContain("한 번 연동하면");
  });
});

function installStorage(additional: Record<string, string> = {}) {
  vi.stubGlobal("localStorage", memoryStorage({
    [BROWSER_CLIENT_ID_KEY]: BROWSER_ID,
    ...additional,
  }));
  vi.stubGlobal("sessionStorage", memoryStorage());
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
