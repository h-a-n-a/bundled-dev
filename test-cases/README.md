# Bundled-dev skip tags — playground checklist

Issue: [vitejs/vite#23028](https://github.com/vitejs/vite/issues/23028) · Repo: `~/Projects/vite` (plain git), one branch per dir

Goal: replace every `skipIf(isBundledDev)` and every `bundledDevExclude` entry with a Vitest tag, so the bundled-dev report keeps two groups apart. Each tagged test or describe also gets `meta: { reason: '…' }`.

| Tag | Meaning | Effect under bundled dev |
|---|---|---|
| `bundled-dev/unsupported` | does not apply to bundled dev, by design | `skip` |
| `bundled-dev/todo` | a bug or missing feature, not passing yet | `todo` |

## Rules

- Go one dir at a time. Agree on the tag and the reason for each case before editing.
- If the skip comment does not say whether the skip is by design, ask before choosing a tag.
- Treat `skipIf(isBundledDev && isWindows)` like any other skip: remove it, or replace it with a tag.
- A tag cannot cancel `runIf` or `test.skip`. Turn `runIf(isServe && !isBundledDev)` into `runIf(isServe)` + tag.
- Never tag a block that is limited to another mode: a `todo` tag wins over `describe.runIf(false)`.
- A whole excluded file becomes `/** @module-tag … */`.
- Don't move on to the next test case until I tell you to. If you are unsure, ask me.
- Use `bundledDevTodo` and `bundledDevUnsupported`. Don't write tags explicitly.
- Put issue numbers in the second argument (`{ vite: [N] }`, `{ rolldown: [N] }`), not in the reason text. Leave out the umbrella vitejs/vite#23028: no `issues` means "no issue yet".
- When the cause is the same, reuse the exact reason text from earlier cases (`git grep -h -A1 "bundledDevTodo(\|bundledDevUnsupported(" -- playground`), so the report groups those tests.
- Name each dir's branch `test/bundled-dev-skip-tags-<dirname>`, e.g. `test/bundled-dev-skip-tags-backend-integration`.
- Create each dir's branch from the branch of the dir before it, in the order of the list below. The `assets` branch is `test/bundled-dev-skip-tags` (vitejs/vite#23680), so `backend-integration` starts from it.
- A dir that needs only a fix and no tags gets a `fix/…` branch instead. It holds the fix and the exclude removal, and the next dir starts from it. `chunk-importmap` is `fix/bundled-dev-chunk-import-map`, so `csp` starts from it.
- The stack is tracked with `gh stack` (github/gh-stack) in `~/Projects/vite`. Add a new branch on top with `gh stack add`, then use `gh stack rebase` and `gh stack push`. Open new PRs with `gh pr create --draft`. Never use `gh stack submit` without `--auto`, and never pass `--open`: both make PRs ready for review.
- When asked to check the discussions, check https://github.com/vitejs/vite/discussions/22746

## Steps for each dir

1. Visit each spec in the dir. List every test case that is skipped under bundled dev (`skipIf(isBundledDev)`, `runIf(… && !isBundledDev)`, or another form).
2. Go through the cases one by one, together. For each case, start the dev server for that playground in bundled dev, so it can be examined in the browser:
   ```sh
   cd ~/Projects/vite/playground/<dir>
   pnpm vite --experimentalBundle   # add --config <file> when the spec uses its own config
   ```
3. Agree on the tag and the reason for the case, then edit it.
4. When the dir is done, tick it in the list below. Then remind me to update the two issue comments (see "Issue comments to update"). Show me a draft of each change, and post only after I allow it.
5. Record every PR of the dir in "PRs per dir": the tagging PR, and each fix PR that removes one of its tags.

## Issue comments to update

Both comments are on vitejs/vite#23028 and belong to me (`h-a-n-a`). Before posting, fetch the comment again and check that it has not changed since the draft.

- **Checklist**: https://github.com/vitejs/vite/issues/23028#issuecomment-5190734145
  - One line per dir: `- [ ] <dir> (<passing under bundled dev>/<passing under plain dev>)`.
  - Take both numbers from the `Tests … passed` count of:
    ```sh
    pnpm run test-serve-bundled playground/<dir>/
    pnpm run test-serve playground/<dir>/
    ```
  - Check the box only when every remaining gap is by design (`unsupported`). A `todo` keeps the box unchecked.
- **Details**: https://github.com/vitejs/vite/issues/23028#issuecomment-5190853274
  - One `## <dir>` section, with gaps grouped by priority (P0 = breaks a real app the most).
  - Each gap lists: what breaks, its tests, the code location if known, the tracking issue (or "No issue yet"), and the effort.
  - Update the counts, causes and test lists that this dir's work changed. Leave out test-only fixes (a bundled-dev branch in the expected value), because they are not gaps.

## PRs per dir

Only PRs opened as part of this work, starting with #23680. All PRs are in vitejs/vite and form one stack, in table order: each one targets the branch of the row above it.

| Dir | PR | Kind | Branch | What it does | State |
|---|---|---|---|---|---|
| `assets` | #23680 | tags | `test/bundled-dev-skip-tags` | tags the 35 skips; adds `meta.issues` to the helpers | open |
| `backend-integration` | #23681 | tags | `test/bundled-dev-skip-tags-backend-integration` | tags the 6 skips; Windows-only `todo` (`windowsTodo`) | open |
| `backend-integration` | #23683 | fix | `fix/bundled-dev-server-origin` | applies `server.origin` to asset URLs; removes 2 `todo` | open |
| `backend-integration` | #23684 | fix | `fix/bundled-dev-windows-file-names` | normalizes memory-file keys (`\` on Windows); removes `windowsTodo` | open |
| `chunk-importmap` | #23685 | fix | `fix/bundled-dev-chunk-import-map` | bundled dev ignores `build.chunkImportMap`; removes the exclude entry | open (draft) |
| `csp` | #23705 | tags | `test/bundled-dev-skip-tags-csp` | tags the 5 skips with one shared `todo` (`transformIndexHtmlTodo`) | open (draft) |

## When I ask you to check the PRs

1. For each row that is not merged, run `gh pr view <number> --repo vitejs/vite --json state,mergedAt,baseRefName`.
2. If a PR is merged:
   - Set its State to `merged <date>` in "PRs per dir".
   - Update the dir's line in the checklist below if it changes (for example, "no tags left").
   - Check that the next PR in the stack now targets the right base (`main` once everything below it is merged).
3. Update the remote tracking (the two issue comments, see "Issue comments to update"):
   - **Checklist:** take the new numbers from `pnpm run test-serve-bundled playground/<dir>/` and `pnpm run test-serve playground/<dir>/` on an up-to-date `main`. Drop the "with #…" part once those fixes are merged. Check the box only when every remaining gap is by design.
   - **Details:** for a merged fix, change its item from `- [ ]` and "Fix open in #N" to `- [x]` and "Fixed in #N", like the `GET /.env` item under `assets`.
   - Show me the drafts, and post only after I allow it.
4. If a PR was closed without merging, tell me. Do not change anything for it.

## Dirs with bundled-dev skips (25)

Counts are from `main` @ `8a4c19cfc`: 141 skip sites and 5 excluded spec files.

- [x] `assets` — 5 specs · 35 skips → 18 `todo` (14 postfix dropped, 3 `?url` CSS #22863, 1 inline `<style>` `@import` HMR) · 17 run (bundled-dev branch in the expected value, `runtime-base`) · `?raw import` log guard (`if (!isBundled)`) kept
- [x] `backend-integration` — 1 spec · 4 skips + 2 Windows-only · vitejs/vite#23681: 2 `todo` (`server.origin` not applied to emitted asset URLs), 2 run (bundled-dev branch in the expected value: CSS HMR uses `<style>`, `hot updated` log), Windows-only `todo` (`windowsTodo`) on the tests that load the page · fixes: vitejs/vite#23683 (`server.origin`), vitejs/vite#23684 (Windows: memory-file keys keep `\` from input keys) → no tags left · issue comments: 5/7, 7/7 with both fixes; P0 Windows 404, P1 entry URL not documented, P1 `server.origin`
- [x] `chunk-importmap` — 1 spec · excluded: `chunk-importmap.spec.ts` · vitejs/vite#23685 → no tags: bundled dev applied the build-only `build.chunkImportMap` (stable chunk names, but no import map in the HTML → 404), fixed by forcing it off in `resolveBuildEnvironmentOptions` · 10/10 under bundled dev with the fix (plain dev 10/10, build 12/12) · issue comments: 0/10, 10/10 with #23685; P0 page fails to load with `build.chunkImportMap: true`
- [x] `csp` — 1 spec · 5 skips · vitejs/vite#23705: 5 `todo`, one shared reason (`issues: { vite: [20374] }`): the playground serves the page from its own middleware (`appType: 'custom'`, a fresh nonce per request), and `server.transformIndexHtml` returns HTML with source URLs that bundled dev does not serve. Bundled dev does build the HTML (`bundledDev.memoryFiles['index.html']`, nonce placeholders included), but a custom server has no supported way to get it · issue comments: 4/9 (plain dev 9/9)
- [ ] `css` — 6 specs · 1 skip
- [ ] `dynamic-import` — 1 spec · 1 skip
- [ ] `env` — 1 spec · 1 skip
- [ ] `environment-react-ssr` — 1 spec · 2 skips
- [ ] `forward-console` — 1 spec · 3 skips
- [ ] `fs-serve` — 3 specs · 1 skip
- [ ] `glob-import` — 1 spec · 3 skips
- [ ] `hmr` — 1 spec · 26 skips
- [ ] `hmr-ssr` — 1 spec · excluded: `hmr-ssr.spec.ts`
- [ ] `js-sourcemap` — 1 spec · 5 skips
- [ ] `json` — 1 spec · 1 skip
- [ ] `legacy` — 8 specs · 1 skip · excluded: `legacy-chunk-importmap.spec.ts`
- [ ] `object-hooks` — 1 spec · excluded: `object-hooks.spec.ts`
- [ ] `optimize-deps` — 1 spec · excluded: `optimize-deps.spec.ts`
- [ ] `optimize-deps-no-discovery` — 1 spec · 1 skip
- [ ] `resolve` — 3 specs · 1 skip
- [ ] `tailwind` — 1 spec · 4 skips
- [ ] `tailwind-v3` — 1 spec · 3 skips
- [ ] `transform-plugin` — 2 specs · 1 skip
- [ ] `tsconfig-json-load-error` — 1 spec · 2 skips (+1 bundled-dev-only test)
- [ ] `worker` — 7 specs · 40 skips

## Dirs with no bundled-dev skip (50)

Check each one for skips that use another form (e.g. an early `return` or `if (isBundledDev)` around an assertion).

- [ ] `alias` — 1 spec
- [ ] `assets-sanitize` — 1 spec
- [ ] `base-conflict` — 1 spec
- [ ] `build-old` — 1 spec
- [ ] `cli` — 1 spec
- [ ] `cli-module` — 1 spec
- [ ] `client-reload` — 1 spec
- [ ] `css-codesplit` — 2 specs
- [ ] `css-codesplit-cjs` — 1 spec
- [ ] `css-dynamic-import` — 1 spec
- [ ] `css-lightningcss` — 1 spec
- [ ] `css-lightningcss-proxy` — 1 spec
- [ ] `css-lightningcss-root` — 1 spec
- [ ] `css-no-codesplit` — 1 spec
- [ ] `css-sourcemap` — 3 specs
- [ ] `data-uri` — 1 spec
- [ ] `define` — 1 spec
- [ ] `dynamic-import-inline` — 1 spec
- [ ] `env-nested` — 1 spec
- [ ] `extensions` — 1 spec
- [ ] `external` — 1 spec
- [ ] `hmr-full-bundle-mode` — 2 specs
- [ ] `hmr-root` — 1 spec
- [ ] `html` — 1 spec
- [ ] `import-attribute` — 1 spec
- [ ] `lazy-compilation` — 1 spec
- [ ] `lib` — 1 spec
- [ ] `minify` — 1 spec
- [ ] `module-graph` — 1 spec
- [ ] `multiple-entrypoints` — 1 spec
- [ ] `nested-deps` — 1 spec
- [ ] `optimize-missing-deps` — 1 spec
- [ ] `preload` — 3 specs
- [ ] `preserve-symlinks` — 1 spec
- [ ] `proxy-bypass` — 1 spec
- [ ] `proxy-hmr` — 1 spec
- [ ] `resolve-tsconfig-paths` — 1 spec
- [ ] `ssr` — 1 spec
- [ ] `ssr-alias` — 1 spec
- [ ] `ssr-conditions` — 1 spec
- [ ] `ssr-deps` — 1 spec
- [ ] `ssr-html` — 1 spec
- [ ] `ssr-noexternal` — 1 spec
- [ ] `ssr-pug` — 1 spec
- [ ] `ssr-resolve` — 1 spec
- [ ] `ssr-wasm` — 1 spec
- [ ] `ssr-webworker` — 1 spec
- [ ] `tailwind-sourcemap` — 1 spec
- [ ] `tsconfig-json` — 1 spec
- [ ] `wasm` — 1 spec

## Not test dirs

- `devtools` — manual playground, no tests
- `resolve-linked` — linked dep used by other playgrounds
