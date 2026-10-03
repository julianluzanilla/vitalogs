# Handoff: VitaLogs — personal health log web app

## Overview
VitaLogs is a single-user, Spanish-language web app for logging personal health events (pain, dizziness, heart rate, blood pressure, medication intake, bathroom visits) and generating reports for a doctor. It will be hosted at **vitalogs.luzaron.uk**.

It must feel like a native app when used on iPhone (installable PWA, bottom tab bar, bottom sheets) and like a desktop web app on PC/iPad (sidebar + centered modals). Light and dark mode with a one-tap toggle.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate this design in a real codebase** using its established patterns. No codebase exists yet, so choose an appropriate stack. Recommended: **React + Vite + TypeScript** (or Next.js), shipped as a **PWA** (manifest + service worker, offline-capable), with a small backend for auth and sync (see "Backend requirements").

`VitaLogs.dc.html` is self-contained and opens in a browser (it depends on a `support.js` runtime that is not included; read the source for structure, styles and logic). All styling is inline; the logic class at the bottom of the file contains the complete data model, validation, report aggregation and sample-data generator — port it directly.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, copy and interactions. Recreate pixel-accurately.

---

## Design Tokens

### Colors (CSS variables; `html.dark` toggles dark)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#EFF7FF` | `#061820` | Page background, sheet background |
| `--surface` | `#FFFFFF` | `#0C2530` | Cards, inputs, unselected chips |
| `--surface2` | `#F3F9FC` | `#11303D` | Row hover, stat tiles, secondary inputs |
| `--line` | `#D9ECF1` | `#1A3F4D` | Borders, separators |
| `--mint` | `#E1FBD7` | `#123B34` | Icon chips background |
| `--teal` | `#16947D` | `#2FBF9E` | "Logs" in wordmark, hover borders, focus |
| `--accent` | `#0F7D69` | `#62DBBF` | Icon glyph color, active tab, links |
| `--ink` | `#0B2E3B` | `#E6F3F7` | Primary text |
| `--muted` | `#557481` | `#8DAEB9` | Secondary text, labels |
| `--primary` | `#0A5E80` | `#2FBF9E` | Primary buttons, selected chips |
| `--primaryHover` | `#084E6B` | `#3ACDAB` | |
| `--onprimary` | `#FFFFFF` | `#04211B` | Text on primary |
| `--navbg` | `rgba(255,255,255,.8)` | `rgba(12,37,48,.82)` | Blurred header / tab bar |
| `--overlay` | `rgba(11,46,59,.38)` | `rgba(0,0,0,.6)` | Modal scrim (+ `blur(4px)`) |
| `--danger` | `#B23A3A` | `#F08A8A` | Errors, delete, logout |
| `--shadow` | `0 1px 2px rgba(11,46,59,.04), 0 10px 30px rgba(11,46,59,.07)` | `0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.3)` | Floating tab bar, toast |

Source palette from the user: `#E1FBD7`, `#16947D`, `#0A5E80`, `#CDECEF`, `#EFF7FF`.
Hero card gradient: `linear-gradient(140deg, #0A5E80, #16947D)` (dark: `#0A5E80 → #0F7D69`), shadow `0 14px 36px rgba(10,94,128,.22)`, text white, sub-text `#E1FBD7`.
`<meta name="theme-color">`: `#EFF7FF` light / `#061820` dark. Body transitions `background-color .25s, color .25s`.

### Typography
Font: **Plus Jakarta Sans** (Google Fonts, 400/500/600/700/800). Numbers use `font-variant-numeric: tabular-nums`.
- Page title H1: 32px / 800 / letter-spacing -0.035em / line-height 1.1
- Login wordmark: 38px / 800 / -0.035em
- Sheet title: 20px / 800 / -0.02em
- Section H2: 17px / 700 / -0.01em
- Body / list title: 15px / 700
- Secondary: 13–14px / 500–600, `--muted`
- Field label: 13px / 700, `--muted`
- Tab bar label: 11px / 700
- Big numeric inputs: LPM 56px/800/-0.04em; BP 44px/800/-0.04em; hero values 34px/800/-0.03em

### Radii
Chips 999px · inputs 12–14px · icon chip 11–14px · buttons 14–16px · type tiles 22px · cards/lists 24px · hero 28px · sheet 28px (mobile: top corners only) · floating tab bar 26px.

### Spacing
Content padding: desktop `44px 44px 64px`, max-width 1120px centered; mobile `12px 20px calc(120px + safe-area-bottom)`. Section gap 28px. Card padding 18–24px. Grid gaps 8–10px.

### Hit targets
Min 44px everywhere; inputs 50px; primary actions 54–56px.

---

## Responsive behavior
Breakpoint **700px** (`window.innerWidth >= 700` → wide).
- **Narrow (iPhone):** sticky blurred top header (logo 30px + wordmark 18px, theme toggle 40px button, avatar 40px button → Perfil). Floating bottom tab bar: `left/right 12px`, `bottom calc(10px + safe-area)`, height 68px, 5-column grid: Hoy · Historial · [＋ center button 52×52 radius 18 primary] · Reportes · Perfil. Forms open as **bottom sheet** (max-height 94vh, drag handle 40×5).
- **Wide (PC/iPad):** left sidebar 256px sticky, border-right `--line`: logo 36px + wordmark 21px, "Nuevo registro" primary button (48px), nav items (44px, active = `--surface` bg + `--ink`), bottom: theme toggle row + user card (initial avatar, name, logout icon). Forms open as **centered modal** (max-width 560, max-height 90vh, radius 28).
- Use `viewport-fit=cover` and `env(safe-area-inset-*)` paddings. Add `apple-mobile-web-app-capable`, status bar style `default` (light) / `black-translucent` (dark), apple-touch-icon = logo.

---

## Screens

### 1. Login
Centered column max-width 380px. Top-right theme toggle (44px, surface, border).
- Logo mark 72×72, radius 22, shadow `0 12px 32px rgba(10,94,128,.28)`.
- Wordmark "Vita" (`--ink`) + "Logs" (`--teal`); subtitle "Tu registro personal de salud."
- Two input rows (56px, radius 16, surface, border, leading 20px icon in `--muted`): "Usuario" (user icon), "Contraseña" (lock icon).
- Error text (14px/600 `--danger`): "Ingresa usuario y contraseña."
- "Entrar" primary button 56px radius 16.
- Footer: "vitalogs.luzaron.uk" 13px muted.
- Prototype accepts any credentials; real app must authenticate (see Backend).

### 2. Hoy (home)
- Date line (14px muted, e.g. "Sábado, 3 de octubre") + greeting H1 "Buenos días / Buenas tardes / Buenas noches, {firstName}" (<12h / <20h / else).
- Two-column auto-fit grid (min 380px): left column = hero + Registrar; right = today list.
- **Hero card** (2 columns divided by `rgba(255,255,255,.18)`): "Presión" last `sys/dia` + "mmHg"; "Pulso" last value + "lpm"; relative time ("Justo ahora", "Hace N min", "Hace N h", else "Ayer · 07:10"). Tapping a half opens a new entry of that type.
- **Registrar**: 3-column grid of 6 tiles (min-height 104, radius 22, surface, border; hover border `--teal`; active scale .96). Each: 42px mint icon chip with 21px accent glyph, label 14px/700. Types: Dolor, Mareo, Pulso, Presión, Medicamento, Baño.
- **Hoy list**: header "Hoy" + "N registros". Card (radius 24) of rows: time (44px col, muted), 40px mint icon chip, title + detail (ellipsis), right badge (15px/800). Rows separated by 1px `--line`; hover `--surface2`; tap → edit. Empty: dashed box "Aún no hay registros hoy."

### 3. Historial
H1 + horizontally scrolling filter chips (Todos + 6 types; 38px, radius 999). Entries grouped by day, newest first; group header "Hoy" / "Ayer" / "Lunes, 28 de septiembre" + count. Same row component as Hoy. Empty: "No hay registros de este tipo."

### 4. Reportes
- Header: H1 "Reportes" + "Resumen para tu médico"; actions "Copiar" (secondary) and "Exportar PDF" (primary).
- Filters card: **Periodo** chips 7 días · 30 días (default) · 90 días · Todo · Personalizado (shows Desde/Hasta date inputs). **Incluir** multi-select chips per type (all on by default).
- Report preview card: "Reporte de salud", "{name} · {range}", "Generado el {date} · N registros". Per included type with data: icon + title, stat tiles grid (min 140px), then scrollable row list (max-height 260) "3 oct · 07:10 — text".
- Stats per type:
  - Presión arterial: Tomas, Promedio sys/dia, Más alta, Más baja (by systolic), Pulso prom.
  - Pulso: Tomas, Promedio, Mínimo, Máximo
  - Dolor: Episodios, Intensidad prom. (1 decimal)/10, Constantes, count per zone
  - Mareo: Episodios, Duración prom., Intensidad prom.
  - Medicamento: Tomas, count per medication
  - Baño: Pipí, Popó
- Exportar PDF: prototype opens a print-styled window and calls `print()`. Production: generate a proper PDF (server or client lib) with the same content, and use the Web Share API on iOS.
- Copiar: plain-text version to clipboard; toast "Resumen copiado".

### 5. Perfil
- Card: initial avatar (56px, radius 18, mint/accent) + "Nombre en reportes" input.
- Settings list card: "Modo oscuro" with iOS switch (50×30, knob 24), "Descargar respaldo" (JSON, shows count), "Restaurar respaldo" (file input), "Cerrar sesión" (danger).
- "Mis medicamentos": list rows (name 15/700, dose muted, trash button) + add form [Nombre][Dosis][＋]. These are the pre-saved medications used in the Medicamento form. Defaults: Losartán 50 mg, Paracetamol 500 mg, Ibuprofeno 400 mg, Betahistina 16 mg, Omeprazol 20 mg (sample only — let user manage).

### 6. Nuevo / Editar registro (sheet/modal)
Header: icon chip + title ("Dolor", "Editar Dolor"...) + "Cambiar tipo" link (new only) + close (X). If opened from the generic ＋, first step is the 6-tile type picker.
Every type: **Fecha** + **Hora** (2-column, default = now, editable).
- **Dolor**: Zona chips — Cabeza, Espalda, Ciática, Cuello, Ojos, Muslo, Pantorrilla, Otro (Otro reveals "Especifica la zona" input). Duración: number input with "min" suffix + "Constante" toggle chip (disables & clears duration, input at 50% opacity). Intensidad: 10-button row 1–10 (default 5), label right "5/10 · Moderado" (1–3 Leve, 4–6 Moderado, 7–8 Fuerte, 9–10 Severo).
- **Mareo**: Duración (min) + Intensidad (same as above, no Constante).
- **Pulso (LPM)**: big centered number "latidos por minuto"; Observaciones.
- **Presión arterial**: big "Sistólica / Diastólica" pair in one card; "Pulso (opcional) … lpm" row; Observaciones.
- **Medicamento**: chips from saved list (selecting pre-fills Dosis); Dosis input; "Síntoma presentado · opcional". If list empty: "Agrega tus medicamentos en Perfil."
- **Baño**: Pipí / Popó big toggle (60px); Cantidad segmented control Muy poco · Poco · Regular (default) · Mucho; Observaciones (placeholder "Color, dolor, condiciones (p. ej. mucho frío)…").
- **Observaciones** (Pulso, Presión): quick-pick chips that toggle comma-separated text in the textarea: "En reposo +10 min", "Al despertar", "Después de subir escaleras", "Después de comer", "Después de ejercicio", "Antes de dormir".
- Footer: [trash 54×54, edit only] + primary "Guardar registro" / "Guardar cambios".
- Validation (inline error, `--danger`): "Indica fecha y hora.", "Selecciona la zona del dolor.", "Especifica la zona.", "Ingresa el resultado.", "Ingresa sistólica y diastólica.", "Selecciona un medicamento.", "Selecciona pipí o popó."
- Toasts (2.2s, bottom center, `--ink` bg / `--bg` text, radius 16): "Registro guardado", "Registro actualizado", "Registro eliminado". Production: add a confirm (or undo toast) before delete.

---

## Interactions
- Tap scrim or X closes the sheet. Production: add slide-up animation for sheets (~250ms, ease-out) and swipe-down to dismiss on mobile.
- Tiles/buttons: `:active` scale .96–.98; hover border `--teal`.
- Theme toggle: moon icon in light, sun icon in dark. Initial value = `prefers-color-scheme`; persists after user toggles. Updates `theme-color` meta.
- Tab change scrolls to top.

## Data model
```ts
type Base = { id: string; type: EntryType; date: 'YYYY-MM-DD'; time: 'HH:MM' };
type Dolor = Base & { type:'dolor'; zone: Zone; zoneOther?: string; constant: boolean; duration?: number; intensity: 1..10 };
type Mareo = Base & { type:'mareo'; duration?: number; intensity: 1..10 };
type Lpm = Base & { type:'lpm'; value: number; obs?: string };
type Presion = Base & { type:'presion'; sys: number; dia: number; pulse?: number; obs?: string };
type Medicamento = Base & { type:'medicamento'; med: string; dose?: string; symptom?: string };
type Bano = Base & { type:'bano'; kind:'pipi'|'popo'; amount:'Muy poco'|'Poco'|'Regular'|'Mucho'; obs?: string };
type Med = { name: string; dose: string };
type Profile = { name: string; meds: Med[]; dark: boolean };
```
Prototype persists everything in `localStorage['vitalogs.v1']` and seeds 14 days of sample data — **remove the seed in production**.

## Backend requirements (not in prototype)
- Real authentication (single user is fine; secure password hashing, session/JWT, HTTPS).
- Server persistence + sync so iPhone, iPad and PC share data; offline-first with local cache and background sync.
- Backup export/import (JSON) kept as in Perfil.
- PDF generation for reports.
- Health data is sensitive: encrypt at rest, no third-party analytics.

## Assets
`icons/` — all original, created for this design:
- `logo-mark.svg` — app logo (gradient rounded square #16947D→#0A5E80 with white pulse "V" line and mint dot). Use for favicon, apple-touch-icon, PWA icons (export PNG 180/192/512).
- 24×24 stroke icons (stroke 2, round caps, black — used as CSS masks so they take `currentColor`): dolor, mareo, lpm, presion, medicamento, bano, home, clock, chart, user, plus, x, trash, share, download, upload, logout, lock, moon, sun, copy. Can be replaced with an equivalent icon library (e.g. Lucide) if preferred.

## Files
- `VitaLogs.dc.html` — full prototype (template markup + logic class with data model, validation, report aggregation).
- `icons/` — SVG assets above.
