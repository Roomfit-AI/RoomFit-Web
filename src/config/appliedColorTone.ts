import type { RoomLayout } from "../types";
import {
  normalizePreferredColorToneId,
  readPreferredColorTone,
  type PreferredColorToneId,
} from "./preferredColorTone";
import { getRoomPreferredColorTone } from "./roomPreferences";

type PaletteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PaletteAwareRoomLayout = RoomLayout & {
  appliedPreferredColorTone?: unknown;
};

export function getLayoutAppliedPreferredColorTone(
  layout: RoomLayout,
): PreferredColorToneId | null {
  return normalizePreferredColorToneId(
    (layout as PaletteAwareRoomLayout).appliedPreferredColorTone,
  );
}

export function withAppliedPreferredColorTone(
  layout: RoomLayout,
  preferredColorTone: unknown,
): RoomLayout {
  const normalized = normalizePreferredColorToneId(preferredColorTone);
  const nextLayout: PaletteAwareRoomLayout = { ...layout };

  if (normalized) {
    nextLayout.appliedPreferredColorTone = normalized;
  } else {
    delete nextLayout.appliedPreferredColorTone;
  }

  return nextLayout;
}

export function resolveRoomLayoutPreferredColorTone(
  layout: RoomLayout,
  storage: PaletteStorage = localStorage,
): PreferredColorToneId | null {
  return getLayoutAppliedPreferredColorTone(layout)
    ?? getRoomPreferredColorTone(layout.id, storage)
    ?? readPreferredColorTone(storage);
}
