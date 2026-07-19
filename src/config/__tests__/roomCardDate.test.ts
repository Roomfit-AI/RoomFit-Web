import { describe, expect, it } from "vitest";

import { formatRoomCardDate } from "../roomCardDate";

describe("formatRoomCardDate", () => {
  it("renders only the ISO calendar date", () => {
    expect(formatRoomCardDate("2026-07-19T00:59:00Z")).toBe("2026년 7월 19일");
    expect(formatRoomCardDate("2026-07-19T23:59:59.999Z")).toBe("2026년 7월 19일");
  });

  it("does not shift the displayed day across timezone boundaries", () => {
    expect(formatRoomCardDate("2026-07-19T23:30:00-10:00")).toBe("2026년 7월 19일");
    expect(formatRoomCardDate("2026-07-19T00:30:00+14:00")).toBe("2026년 7월 19일");
  });

  it("uses the fallback for malformed or impossible dates", () => {
    expect(formatRoomCardDate("not-a-date")).toBe("최근 업로드");
    expect(formatRoomCardDate("2026-02-30T12:00:00Z")).toBe("최근 업로드");
    expect(formatRoomCardDate("2026-13-01")).toBe("최근 업로드");
  });
});
