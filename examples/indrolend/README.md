# Indrolend SPA content

This directory contains the Indrolend catalog selected by the root SPA entrypoint.

The Games section currently exposes three items through the same catalog:

- **Asymptote Engine** — uses the item-scoped adapter/application lifecycle registered as `games/asymptote`.
- **Drift** — currently opens the bundled `/drift/` application through its primary link action.
- **DATA** — currently exposes the rolling native Windows download from `Digital-breakdown-dev` as its primary link action.

These Drift and DATA actions are intentionally interim integration points. The shell owns navigation, hero interaction, actionability, accessibility, and particle transition semantics; richer product presentation should be added through item adapters rather than by adding product-specific behavior to `main.js`.
