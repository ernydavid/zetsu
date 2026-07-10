<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Form UX Rules

- Every new form must provide visible submit feedback:
  - disable submit and cancel controls while submitting
  - show a loading state on the primary action with `IconLoader2` or the project-equivalent loader
- Every successful form submission must give explicit feedback:
  - show a success toast
  - close the dialog or reset the form when the action succeeds
- Every failed form submission must give explicit feedback:
  - show an error toast
  - if the page also receives an `error` query param from a redirect, mirror it in a toast and then clear the URL state
- Prefer the client-side action wrapper pattern already used in dashboard modules:
  - wrap server actions with `startTransition`
  - catch unexpected errors and show `sileo.error`
  - rethrow `NEXT_REDIRECT` errors so Next.js can complete navigation correctly
