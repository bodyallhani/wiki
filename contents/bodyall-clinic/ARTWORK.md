# Game asset provenance

Generated with the built-in imagegen tool. Two separate new-image requests, generated in parallel. Original files copied without image modification.

## Consultation room

- Path: `assets/clinic-room.webp`
- Source: `/workspace/scratch/7a742eaaf213/generated_images/exec-a4c782fc-a410-4fa6-8bfc-fb4be630ccaa.png`
- Dimensions: 1536 × 1024

```text
Use case: illustration-story
Asset type: finished original landscape background asset for a narrative PC game, 1536 by 1024 pixels, no UI.
Primary request: A richly detailed high-resolution pixel-art illustrated fictional Korean clinic consultation room, cozy and dignified, in late afternoon.
Scene/backdrop: Walnut wood desk running low along the bottom edge, tasteful dark teal consultation chair, ivory clinic storage cabinets, aged brass and gold accents, a broad window with an understated Korean city view, botanical leaves and small plants, books and simple desk supplies at the edges. Central seating area remains visually calm and mostly clear to composite a waist-up character portrait over it.
Style/medium: Nostalgic late-1990s and early-2000s illustrated PC raising simulation games and detailed Romance of the Three Kingdoms IV era pixel artwork. Fine deliberate pixel clusters and nuanced painted pixel shading, richly detailed at high resolution. Not tiny low-resolution 8-bit. Warm inviting adult aesthetic.
Composition/framing: Landscape 3:2. Eye-level room view, well balanced, architectural details across the back wall. Desk only along bottom, no large foreground objects and no objects blocking the center.
Lighting/mood: Soft warm late afternoon window light, quiet comforting consultation atmosphere, subtle golden highlights and deep teal shadows.
Color palette: Dark teal, aged gold, warm ivory and walnut brown.
Constraints: Entirely original fictional room. Absolutely no people or figures, no text of any kind, no logos, no lettering or watermarks. No medical anatomical models. This is the actual game background asset, not a screenshot, mockup, framed artwork or UI.
```

## Office worker expression sheet

- Path: `assets/portraits.webp`
- Source: `/workspace/scratch/7a742eaaf213/generated_images/exec-bf39b42e-8886-4f90-8191-1874798cb142.png`
- Dimensions: 1536 × 1024; nominal cells 512 × 512, 3 columns × 2 rows.
- Expression order: neutral smile, tired, sheepish, surprised, thoughtful, comfortable speaking.
- Visual inspection: six consistent portraits and requested expressions. PNG is RGBA with alpha range 0–254; actual transparency exists. 694,020 of 1,572,864 pixels (44.1%) are fully transparent; major background sample points are alpha 0, while character interiors are mostly alpha 252–253. RGB preview may show gray shading in transparent regions, but the original alpha is preserved. Portraits meet their bottom cell boundary.

```text
Use case: illustration-story
Asset type: Production sprite sheet with SIX WAIST-UP character portraits, 1536 by 1024 pixels.
Primary request: Exactly 3 columns by 2 rows, equally sized regular 512x512 cells, of the SAME friendly fictional Korean male office worker in his mid-30s, short dark hair with subtle side part, white shirt with sleeves rolled up, loosened dark teal tie, understated simple lanyard. Detailed retro PC anime pixel artwork.
Subject: One consistent adult male identity across all six cells. Friendly and approachable, adult proportions, not chibi. Consistent face shape, haircut, clothing and body size. Each isolated bust framed waist-up, centered in its cell, all artwork well inside the cell with generous padding above head and along both sides. Shoulder span and head size exactly consistent in all six.
Expressions in row-major order: TOP LEFT neutral small smile; TOP CENTER tired with slightly drooping eyes; TOP RIGHT sheepish embarrassed smile; BOTTOM LEFT surprised, eyebrows raised and mouth slightly open; BOTTOM CENTER thoughtful with modest hand near chin; BOTTOM RIGHT comfortable speaking, relaxed open mouth and a modest hand gesture.
Style/medium: High-resolution fine pixel-art clusters, detailed nostalgic late-1990s and early-2000s PC raising simulation / illustrated adventure game character portraits, retro anime facial rendering with nuanced shading, warm adult aesthetic. Clear readable pixels, not blurry vector art, not tiny low-res 8-bit.
Composition/framing: EXACT regular 3 by 2 grid with no visible cell boundaries. All six characters complete and separate, every portrait stays inside its own 512x512 cell. No overlaps, no cropped heads or hands, same waist baseline in every cell. Modest arms and hands with clean anatomy, no props.
Background: Actual alpha transparency, transparent background between and behind the six portraits. Do not draw checkerboard. If alpha transparency is unavailable, use one perfectly solid very dark teal #102d30 background over the entire sheet.
Constraints: No text, no labels, no logos, no watermarks, no borders, no grid lines. EXACTLY six portraits, exactly three columns and two rows. This is a game sprite asset, not a UI, character design poster, screenshot or mockup.
```

## Production encoding
The original 1536×1024 outputs were encoded as WebP at quality 92 and alpha quality 100 with no resizing or compositional changes. Runtime assets: `assets/clinic-room.webp`, `assets/portraits.webp`.
