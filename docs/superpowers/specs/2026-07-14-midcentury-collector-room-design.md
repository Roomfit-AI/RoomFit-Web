# Mid-century collector sample room design

## Goal

Add a second, independently selectable sample room inspired by the supplied
reference: a bright modern mid-century bedroom/studio for hobbies and
collectibles. The existing sample room and its natural-wood scenario remain
unchanged.

## Delivery shape

- The backend seeds a second `RoomSource.SAMPLE` room named `미드센추리 컬렉터 룸`.
- It uses a 6.4m × 5.8m open-corner room, one large north-wall window, and a
  south-wall entry so it appears as a separate card in `/rooms` for every
  client using the same backend.
- The frontend keeps the existing `Furniture` schema and maps the new sample's
  stable furniture IDs to a procedural mid-century renderer. No external
  model, texture, image, or new API field is introduced.

## Layout

The room is divided into clear zones with the middle kept open.

| Zone | Objects | Placement |
| --- | --- | --- |
| Window / sleeping | single walnut-and-coral bed, coral bedside table, small lamp, floor plant | left side below the north-west window |
| Work / display | warm-wood desk, chair, cobalt modular cabinet, chrome-and-glass display shelf | back-left wall, with the chair facing the desk |
| Storage / collectibles | low cream console, turntable, records, framed poster, red display shelves | right wall |
| Lounge | cream round rug, glass coffee table, coral lounge chair, cane/chrome side chair, small plant | centre-right / south-east |

The wardrobe-like tall storage from the original sample is not copied into the
new room. The new sample has its own furniture IDs and placement only.

## Visual implementation

`FurnitureRenderer` will route only `collector-*` IDs to a new procedural
mid-century furniture component in the existing furniture component folder.
The component will use grouped standard Three.js geometry:

- boxes and cylinders for the bed, desk, modular cabinet, console, records,
  shelves and posters;
- spheres, cylinders and emissive materials for lamps and collectible figures;
- transparent box/cylinder surfaces plus chrome supports for the display shelf
  and glass coffee table;
- torus/cylinder accents for the turntable record and rug trim;
- the existing `Plant` component for floor and tabletop plants.

The palette is warm white `#F3EEE8`, light wood `#C99A68`, walnut `#5A3422`,
cream `#F7F1E8`, coral `#D98272`, retro red `#B64535`, cobalt `#1E63C6`,
mustard `#D6A23A`, chrome `#C9C9C9`, and plant green `#2F6B3F`.

## Data flow

1. `RoomSampleDataInitializer` creates both the existing sample and the new
   collector sample at server startup.
2. `/api/rooms/samples` returns both rooms.
3. `Rooms.tsx` already renders every API sample card; no selection-page logic
   changes are needed.
4. `api/rooms.ts` translates the stable collector IDs into existing furniture
   categories, geometry and colour/material values.
5. `FurnitureRenderer` recognizes only those collector IDs and renders their
   procedural details. Other room data keeps the current renderer path.

## Constraints and acceptance checks

- Keep the API and `Furniture` schemas unchanged.
- Do not modify the existing sample-room data.
- Do not use external assets or model files.
- Keep TransformControls, selection boxes and helpers hidden in the default
  presentation viewer; the existing management-only helper flag remains.
- Verify backend compilation/tests relevant to sample-room listing and run
  `npx vite build` for the frontend.
- Manually verify that the new room appears as an additional `/rooms` card,
  furniture stays inside the room, and the camera shows all four zones.
