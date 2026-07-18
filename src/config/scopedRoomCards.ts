import type { SampleRoomCard, UploadedRoomCard } from "../api/rooms";

export type RoomCardScope = "PUBLIC" | "BROWSER" | "PAIRED_APP";

export type ScopedRoomCard =
  | { scope: "PUBLIC"; room: SampleRoomCard }
  | { scope: "BROWSER" | "PAIRED_APP"; room: UploadedRoomCard };

export function roomCardKey(card: ScopedRoomCard): string {
  return `${card.scope.toLowerCase()}:${card.room.roomId}`;
}
