# University logos

Drop one file per university here, named by its `id` in `src/data/universities.json`.

```
imperial.svg
ucl.svg
oxford.png
cambridge.svg
...
```

Accepted extensions, in the order they are tried: `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`.

**Rules**

- Use the official file from the university's brand kit. Logos are never
  redrawn, traced or recreated in this project.
- Prefer SVG. If you only have a raster file, supply it at 400px wide or more —
  the booth screen is 1080p and a small PNG shows it.
- Aspect ratio is preserved everywhere. A logo is fitted inside its box, never
  stretched: 120×64 on a drag card, 44×30 on a map pin.
- A university with no file here still plays. It shows a neutral card with the
  university's initials, and the admin **Logos** tab lists it as missing.

Check what is missing at any time: open the admin screen (hold the company logo
for three seconds, PIN 2026) and go to the **Logos** tab.
