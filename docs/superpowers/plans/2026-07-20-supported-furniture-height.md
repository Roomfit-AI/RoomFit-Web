# Supported Furniture Height Implementation Plan

> **For Codex:** Execute this plan with `superpowers:executing-plans`. The user explicitly waived the TDD RED step; add the regression test after implementation.

**Goal:** Render uploaded-room monitors and TVs at desk/media-console top height even when coordinate normalization causes small center drift.

**Architecture:** Replace exact center equality with a rotated supporter-footprint containment check. Continue deriving height at render time so independent movement remains possible and leaving the top surface drops the screen to the floor.

**Tech Stack:** TypeScript, React, Vitest.

### Task 1: Resolve support by top footprint

**Files:**
- Modify: `src/components/room/furnitureSupportPlacement.ts`
- Modify: `src/components/room/__tests__/furnitureSupportPlacement.test.ts`

1. Resolve each candidate supporter's rotated local footprint.
2. Select a matching supporter when the dependent center lies inside its top footprint, preferring the closest center.
3. Set `y = supporter.height + dependent.height / 2`; retain floor height outside all supports.
4. Add tests for small center drift, rotated supports, independent movement, and deleted supports.

### Task 2: Minimal verification

1. Run the focused Vitest file.
2. Run TypeScript/build verification and `git diff --check`.
3. Commit, push, and open a ready PR.
