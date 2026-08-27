---
kind: frontend_style
name: Tailwind CSS 4 + Shadcn/ui Design System with Custom Dark Neon Theme
category: frontend_style
scope:
    - '**'
source_files:
    - src/styles.css
    - components.json
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - package.json
---

## What system/approach is used

The frontend styling stack is built on **Tailwind CSS v4** (via `@tailwindcss/vite` plugin) combined with the **Shadcn/ui** component library in its "new-york" style, layered over a custom dark music-tech design system. The project uses:

- **Tailwind CSS v4** as the utility-first engine, imported via `@import "tailwindcss" source(none)` and scanned from `../src`.
- **Shadcn/ui** configured through `components.json` (`style: new-york`, `tsx: true`, `cssVariables: true`, base color `slate`) with Radix UI primitives under the hood.
- **tw-animate-css** for prebuilt animation utilities.
- **class-variance-authority (cva)** + **clsx** + **tailwind-merge** for composable component variants and class merging (`src/lib/utils.ts` exposes a `cn()` helper).
- A single global stylesheet at `src/styles.css` that defines the entire design token surface.

## Key files and packages

- `src/styles.css` — central design system: CSS custom properties, Tailwind theme tokens, base layer styles, custom utilities, animations, and responsive helpers.
- `components.json` — Shadcn/ui configuration pointing to Tailwind CSS entry, aliases (`@/components`, `@/components/ui`, `@/lib/utils`, etc.), and Radix-based component generation.
- `src/components/ui/*.tsx` — generated Shadcn/ui primitives (button, dialog, dropdown-menu, input, slider, switch, checkbox, label). Each uses `cva` variants and the shared `cn()` util.
- `src/lib/utils.ts` — `cn(...inputs)` merges classes via `clsx` + `tailwind-merge`.
- `package.json` — declares `tailwindcss ^4.2.1`, `@tailwindcss/vite ^4.2.1`, `tw-animate-css ^1.3.4`, `class-variance-authority ^0.7.1`, `clsx ^2.1.1`, `tailwind-merge ^3.5.0`, plus all `@radix-ui/*` primitives consumed by Shadcn components.

## Architecture and conventions

### Design tokens and theming
All visual tokens live in `:root` CSS variables inside `src/styles.css` and are exposed to Tailwind via an inline `@theme` block. Tokens follow a semantic naming scheme consistent with Shadcn/ui:

- Surface palette: `--background`, `--foreground`, `--card`, `--card-foreground`, `--surface`, `--surface-foreground`, `--popover`, `--popover-foreground`.
- Semantic colors: `--primary` (neon pink/magenta), `--secondary`, `--muted`, `--accent` (neon cyan), `--destructive`, `--border`, `--input`, `--ring`, `--ring-soft`, `--glow`.
- Typography: `--font-display` = Bricolage Grotesque; `--font-sans` = Manrope.
- Shadows: `--shadow-glow`, `--shadow-lift`, `--shadow-neon`, `--shadow-neon-cyan`.
- Gradients: `--gradient-hero` (ambient radial glows), `--gradient-brand` (pink → purple → cyan linear gradient), `--gradient-brand-subtle`.
- Radius scale: `--radius-sm` … `--radius-3xl` derived from a base `--radius: 0.875rem`.

A `dark` variant is enabled via `@custom-variant dark (&:is(.dark *))`, so the same tokens apply under a `.dark` root class.

### Component styling convention
Every Shadcn/ui primitive follows the same pattern:
1. Define a `cva` variant map (`variant`, `size`, etc.) using Tailwind utility strings that reference the semantic CSS variables (e.g. `bg-primary`, `text-primary-foreground`).
2. Merge user-provided `className` through `cn(buttonVariants({ variant, size, className }))`.
3. Expose both the component and its underlying `*Variants` type for consumers.

This ensures brand-consistent styling without hard-coded colors in components.

### Custom utilities and animations
`src/styles.css` defines a rich set of reusable `@utility` blocks grouped by purpose:
- Glass effects: `glass`, `glass-panel`, `glass-premium` (backdrop-filter blur + saturate + translucent backgrounds).
- Glow/neon effects: `shadow-player`, `shadow-neon`, `shadow-neon-cyan`, `hover-glow`, `icon-glow`, `focus-ring-neon`, `animate-neon-pulse`, `animate-neon-glow`.
- Brand gradients: `bg-hero-glow`, `text-gradient-brand`, `progress-gradient`.
- Motion: `animate-spin-slow`, `animate-bar`, `animate-ambient`, `animate-fade-in-up`, `animate-page-in`, `animate-slide-up`, `animate-scale-in`, `animate-waveform`, `ripple-effect`.
- Scrollbars: `scrollbar-hide`, `scrollbar-premium` (thin, themed thumb/track).
- Layout grids: `responsive-grid`, `responsive-grid-md/lg/xl` for card rows.
- Media queries: mobile/tablet/desktop visibility helpers (`mobile-hidden`, `tablet-grid-2`, `desktop-hidden`).

### Responsive strategy
Responsive behavior is primarily handled via Tailwind's built-in breakpoints applied directly in JSX class strings. The stylesheet supplements this with explicit `@media` blocks for device-specific overrides (mobile ≤768px, tablet 769–1024px, desktop ≥1025px) and grid utilities that adjust column counts.

### Iconography
Icons come from **Lucide React** (`lucide-react` dependency) and are composed into Shadcn/ui primitives (e.g., button icons use `[&\_svg]:size-4`).

## Conventions and constraints

- **All colors must be referenced via semantic CSS variables or Tailwind semantic names** (`bg-primary`, `text-destructive`, etc.); raw hex/RGB values are avoided in components and only appear in the central token definitions.
- **Component classes are composed through `cn()`**, never concatenated with `+`; this guarantees Tailwind-merge deduplication.
- **Variant-driven styling**: every shadcn/ui component exposes a `cva`-based variant map; new components should follow the same `variants` + `defaultVariants` shape.
- **Theme tokens are centralized in `src/styles.css`**; adding a new color or radius requires updating both the `:root` variable and the corresponding `@theme inline` mapping.
- **Dark mode is opt-in via the `.dark` class** on the root element, activated by the `dark` custom variant; components do not branch on light/dark logic themselves.
- **Animations are declared as `@keyframes` + `@utility` pairs** in the stylesheet and reused via class names rather than inline styles.
- **Glass morphism and neon glow are the preferred visual treatments** for cards, panels, and interactive surfaces, as evidenced by the dedicated `glass`, `glass-panel`, `glass-premium`, `shadow-neon`, and `hover-glow` utilities.