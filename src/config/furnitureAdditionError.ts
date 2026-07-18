export type FurnitureAdditionFailureKind = "PLACEMENT_REJECTED" | "NETWORK" | "SERVER";

export class FurnitureAdditionRequestError extends Error {
  readonly kind: FurnitureAdditionFailureKind;

  constructor(
    kind: FurnitureAdditionFailureKind,
    options?: ErrorOptions,
  ) {
    super(messageByKind[kind], options);
    this.name = "FurnitureAdditionRequestError";
    this.kind = kind;
  }
}

const messageByKind: Record<FurnitureAdditionFailureKind, string> = {
  PLACEMENT_REJECTED: "선택한 가구를 현재 공간에 안전하게 추가하지 못했습니다. 가구 수를 줄이거나 다른 가구를 선택해 주세요.",
  NETWORK: "가구 추가 서버에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  SERVER: "가구 추가 서버에서 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export function getFurnitureAdditionErrorMessage(error: unknown): string | null {
  return error instanceof FurnitureAdditionRequestError ? error.message : null;
}
