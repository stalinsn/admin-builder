# Ecommerce styles (nested BEM)

This folder contains ecommerce-only styles refactored to use CSS Nesting while preserving the exact selector outputs and specificity.

Conventions
- Keep the public class names unchanged (BEM blocks/elements/modifiers).
- Use `&` for elements/modifiers/pseudos inside their block scope.
- Co-locate responsive rules inside the closest related block when it improves readability; otherwise keep them flat to match original cascade.
- Don’t change import order in `index.css`.
- Avoid increasing specificity. If a selector was flat, keep the final compiled selector identical.

Validation
- Build must pass without CSS syntax errors.
- After changes, run the production build to ensure Next.js/Tailwind/PostCSS compiles nesting correctly.

Notes
- Variables live in `variables.css` and brand overrides in `theme-classic.css`.
- If a utility or global selector doesn’t belong to a block, keep it flat to avoid unintended scoping.
