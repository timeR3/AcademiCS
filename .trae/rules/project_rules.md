# AcademyCS Visual System Rules
## Importante
- Nunca usar node.js ni next.js
- Siempre usar php para el backend

## Mandatory Visual Identity
- Use only this official palette:
  - Deep blue: `#132F4C`
  - Sage green: `#AEB8A9`
  - Terracotta pink: `#B97A7E`
  - Sand beige: `#D8CFC0`
  - White: `#FFFFFF`
- Keep white as the predominant background for light mode.
- Use deep blue as the core brand color and as the base for dark mode.

## Style Direction
- Premium corporate aesthetic.
- Minimalist and elegant visual hierarchy.
- Real estate SaaS look and feel.
- Spacious layout and comfortable spacing.
- Rounded corners should default to `rounded-2xl` for major surfaces.
- Use soft shadows and avoid harsh elevation.
- Interactions must include subtle microinteractions.
- SPA behavior must feel smooth and polished.

## Implementation Rules for UI Changes
- Reuse existing design tokens in `src/app/globals.css`.
- Prefer semantic token classes (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`) over hardcoded values.
- If custom color usage is needed, use Tailwind brand tokens from `brand.deepBlue`, `brand.sage`, `brand.terracotta`, `brand.sand`, `brand.white`.
- Do not introduce new brand colors without explicit approval.
- For new cards, panels, containers, or dialogs:
  - use `rounded-2xl`
  - use soft shadow
  - ensure generous inner spacing
- For buttons, links, and form controls:
  - preserve smooth transition timing
  - maintain visible and elegant focus states

## Dark Mode Rules
- Dark mode must remain based on deep blue tones.
- Text contrast must stay high and accessible.
- Accent usage in dark mode should stay subtle and premium.

## Consistency Checklist Before Finishing Any UI Task
- Palette compliance verified.
- Spacing and rounded corners aligned with this guide.
- Shadows and transitions feel subtle and premium.
- Light and dark mode both visually coherent.
- No visual drift from the corporate real estate SaaS identity.
