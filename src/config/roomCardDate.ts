const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/;

export function formatRoomCardDate(createdAt: string): string {
  const match = ISO_DATE_PREFIX.exec(createdAt);
  if (!match) return "최근 업로드";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year
    || utc.getUTCMonth() !== month - 1
    || utc.getUTCDate() !== day) {
    return "최근 업로드";
  }
  return `${year}년 ${month}월 ${day}일`;
}
