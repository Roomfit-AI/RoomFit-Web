const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_PATTERN = /^[A-Z0-9]{8}$/;

export const PAIRING_CODE_FORMAT_ERROR = "앱에 표시된 8자리 연결 코드를 입력해주세요.";

export function formatPairingCodeInput(value: string): string {
  const characters = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, PAIRING_CODE_LENGTH);
  return formatCharacters(characters);
}

export function normalizePairingCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.toUpperCase().replace(/\s/g, "");
  if (!/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(compact)) return null;

  const characters = compact.replace("-", "");
  return PAIRING_CODE_PATTERN.test(characters) ? formatCharacters(characters) : null;
}

export function isValidPairingCode(value: unknown): boolean {
  return normalizePairingCode(value) !== null;
}

function formatCharacters(characters: string): string {
  return characters.length <= 4
    ? characters
    : `${characters.slice(0, 4)}-${characters.slice(4)}`;
}
