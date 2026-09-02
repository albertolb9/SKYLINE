# TASK-P0-repository-bootstrap

**Scope:** `PROTOTYPE_V1.md` §7 P0 — Repository Bootstrap only. Pure tooling setup; no product/game logic.

**Requirement IDs:** none apply directly — P0 has no product-behavior surface. Governing spec is `PROTOTYPE_V1.md` §7 P0 itself (exit criterion: "clean app builds/tests and displays an empty Pixi stage"), read together with `ARCHITECTURE.md` §2–3 (technology baseline, module boundaries) and CLAUDE.md §8 (TypeScript strict mode).

## Stack chosen

Plain Vite + Svelte 5 (no SvelteKit — confirmed with the user; single canvas view, no routing/SSR needed), PixiJS 8, TypeScript strict, Vitest, Storybook + `@storybook/addon-svelte-csf`. Versions verified today against `github.com/StakeEngine/web-sdk` per `STAKE_ENGINE_RULES.md` SE-021 (see README "Tooling baseline" table for the exact pinned/installed versions).

Single pnpm package, not a TurboRepo monorepo — `ARCHITECTURE.md` §3's module tree is already a single `src/` tree; TurboRepo exists upstream to manage their multiple games/packages, which doesn't apply to a one-game repo.

## Files touched

- Root tooling: `package.json`, `tsconfig.json`, `vite.config.ts`, `svelte.config.js`, `eslint.config.js`, `.prettierrc.json`, `.gitignore`, `.npmrc`, `index.html`, `.storybook/main.ts`, `.storybook/preview.ts`
- Source: `src/main.ts`, `src/vite-env.d.ts`, `src/app/App.svelte`, `src/renderer/pixi-stage/createPixiStage.ts`, `src/renderer/pixi-stage/PixiStage.svelte`, `src/renderer/pixi-stage/createPixiStage.test.ts`, `src/renderer/pixi-stage/PixiStage.stories.svelte`
- Docs: `README.md` (tool versions + commands), this file

## Tests

- `createPixiStage.test.ts` — Vitest, mocks `pixi.js`'s `Application` so no real WebGL/canvas is required in the unit environment; asserts `app.init` is called with the container as `resizeTo`, the canvas is appended into the container, and `destroy()` tears the Application down.
- Real rendering (an actual empty Pixi canvas on screen) is verified visually via `pnpm dev` and the `PixiStage` Storybook story, not in Vitest.

## Exit criteria

- `pnpm install`, `pnpm build`, `pnpm test`, `pnpm typecheck` all pass clean.
- `pnpm dev` and `pnpm storybook` both visually render an empty Pixi stage.
- No `book/`, `tower/`, `round/`, `rgs/`, `ui/` modules, no fixture Books, no RGS client — all deferred to their own later `PROTOTYPE_V1.md` phases.
