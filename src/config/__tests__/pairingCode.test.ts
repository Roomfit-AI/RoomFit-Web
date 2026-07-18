import { describe, expect, it } from "vitest";

import { formatPairingCodeInput, isValidPairingCode, normalizePairingCode } from "../pairingCode";

describe("pairing code formatting", () => {
  it("uppercases and formats compact or hyphenated input", () => {
    expect(formatPairingCodeInput("k7x9qp42")).toBe("K7X9-QP42");
    expect(formatPairingCodeInput("k7x9-qp42")).toBe("K7X9-QP42");
    expect(normalizePairingCode(" k7x9 qp42 ")).toBe("K7X9-QP42");
  });

  it("rejects short and unsupported input", () => {
    expect(isValidPairingCode("K7X9-QP4")).toBe(false);
    expect(isValidPairingCode("K7X9-@P42")).toBe(false);
  });

  it("caps display input at eight code characters", () => {
    expect(formatPairingCodeInput("abcd12345extra")).toBe("ABCD-1234");
  });
});
