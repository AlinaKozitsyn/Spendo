# UI Kit — Design System

> Define your project's visual language here.
> Reference this when building any UI component.

---

## 1. Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | `{{HEX}}` | Buttons, links, active states |
| `--color-secondary` | `{{HEX}}` | Secondary actions, accents |
| `--color-background` | `{{HEX}}` | Page background |
| `--color-surface` | `{{HEX}}` | Cards, panels |
| `--color-text` | `{{HEX}}` | Body text |
| `--color-text-muted` | `{{HEX}}` | Secondary text |
| `--color-success` | `#22c55e` | Success states |
| `--color-warning` | `#f59e0b` | Warning states |
| `--color-danger` | `#ef4444` | Error states, destructive actions |

---

## 2. Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-heading` | `{{FONT}}` | Headings (h1–h6) |
| `--font-body` | `{{FONT}}` | Body text, paragraphs |
| `--font-mono` | `monospace` | Code, technical values |

### Scale

| Level | Size | Weight | Line Height |
|-------|------|--------|-------------|
| h1 | 2rem | 700 | 1.2 |
| h2 | 1.5rem | 700 | 1.3 |
| h3 | 1.25rem | 600 | 1.4 |
| body | 1rem | 400 | 1.6 |
| small | 0.875rem | 400 | 1.5 |

---

## 3. Spacing

| Token | Value |
|-------|-------|
| `--space-xs` | 4px |
| `--space-sm` | 8px |
| `--space-md` | 16px |
| `--space-lg` | 24px |
| `--space-xl` | 32px |
| `--space-2xl` | 48px |

---

## 4. Components

### Buttons

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Primary | `--color-primary` | white | none |
| Secondary | transparent | `--color-primary` | `--color-primary` |
| Danger | `--color-danger` | white | none |
| Ghost | transparent | `--color-text` | none |

### Cards

- Background: `--color-surface`
- Border radius: 8px
- Padding: `--space-lg`
- Shadow: subtle drop shadow

### Inputs

- Border: 1px solid `--color-text-muted`
- Border radius: 4px
- Padding: `--space-sm` `--space-md`
- Focus: `--color-primary` border + ring

---

## 5. Accessibility

- **Contrast:** Minimum 4.5:1 for body text, 3:1 for large text
- **Focus states:** Visible focus ring on all interactive elements
- **Keyboard:** All interactive elements reachable via Tab
- **Motion:** Respect `prefers-reduced-motion`
- **Semantics:** Use proper HTML elements (`button`, `a`, `input`, `nav`, etc.)
