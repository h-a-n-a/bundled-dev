# Bundled-dev skip tags — playground checklist

Issue: [vitejs/vite#23028](https://github.com/vitejs/vite/issues/23028) · Repo: `~/Projects/vite` (plain git), one branch per dir

Goal: replace every `skipIf(isBundledDev)` and every `bundledDevExclude` entry with a Vitest tag, so the bundled-dev report keeps two groups apart. Each tagged test or describe also gets `meta: { reason: '…' }`.

| Tag                       | Meaning                                   | Effect under bundled dev |
| ------------------------- | ----------------------------------------- | ------------------------ |
| `bundled-dev/unsupported` | does not apply to bundled dev, by design  | `skip`                   |
| `bundled-dev/todo`        | a bug or missing feature, not passing yet | `todo`                   |

## Rules

- Go one dir at a time. Agree on the tag and the reason for each case before editing.
- If the skip comment does not say whether the skip is by design, ask before choosing a tag.
- Treat `skipIf(isBundledDev && isWindows)` like any other skip: remove it, or replace it with a tag.
- A tag cannot cancel `runIf` or `test.skip`. Turn `runIf(isServe && !isBundledDev)` into `runIf(isServe)` + tag.
- A guard inside a test (`if (isBundled) return`, `if (!isBundledDev) { … }`, or similar) hides part of the test under bundled dev without a tag, so the report does not show the gap. Split the guarded part into its own test, placed right after the original, and tag it.
  - Name it after the original, plus what the split part checks (e.g. `linked css HMR`).
  - If the guard also covers build (`isBundled`), add `runIf(isServe)` to the new test.
  - Example: `css` (vitejs/vite#23707).
- A bundled-dev branch in the expected value (`isBundled ? /base64/ : '/nested/icon.png'`) is not a guard. Keep it, with no tag.
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

1. Visit each spec in the dir. List every test case that is skipped under bundled dev (`skipIf(isBundledDev)`, `runIf(… && !isBundledDev)`, a guard inside a test, or another form).
2. Go through the cases one by one, together. For each case, start the dev server for that playground in bundled dev, so it can be examined in the browser:
   ```sh
   cd ~/Projects/vite/playground/<dir>
   pnpm vite --experimentalBundle   # add --config <file> when the spec uses its own config
   ```
3. Agree on the tag and the reason for the case, then edit it.
4. When the dir is done, tick it in the list below. Do not list its remaining gaps here: the two issue comments are the single source of truth for gaps. Then remind me to update the two issue comments (see "Issue comments to update"). Show me a draft of each change, and post only after I allow it.
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

| Dir                     | PR     | Kind | Branch                                             | What it does                                                                                                                                                                                                                                                                                                                 | State             |
| ----------------------- | ------ | ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `assets`                | #23680 | tags | `test/bundled-dev-skip-tags`                       | tags the 35 skips; adds `meta.issues` to the helpers                                                                                                                                                                                                                                                                         | merged 2026-10-09 |
| `backend-integration`   | #23681 | tags | `test/bundled-dev-skip-tags-backend-integration`   | tags the 6 skips; Windows-only `todo` (`windowsTodo`)                                                                                                                                                                                                                                                                        | merged 2026-10-09 |
| `backend-integration`   | #23683 | fix  | `fix/bundled-dev-server-origin`                    | applies `server.origin` to asset URLs; removes 2 `todo`                                                                                                                                                                                                                                                                      | merged 2026-10-09 |
| `backend-integration`   | #23684 | fix  | `fix/bundled-dev-windows-file-names`               | normalizes memory-file keys (`\` on Windows); removes `windowsTodo`                                                                                                                                                                                                                                                          | merged 2026-10-09 |
| `chunk-importmap`       | #23685 | fix  | `fix/bundled-dev-chunk-import-map`                 | bundled dev ignores `build.chunkImportMap`; removes the exclude entry                                                                                                                                                                                                                                                        | merged 2026-10-09 |
| `csp`                   | #23705 | tags | `test/bundled-dev-skip-tags-csp`                   | tags the 5 skips with one shared `todo` (`transformIndexHtmlTodo`)                                                                                                                                                                                                                                                           | merged 2026-10-09 |
| `css`                   | #23707 | tags | `test/bundled-dev-skip-tags-css`                   | tags `?url` as `todo`; splits 4 HMR edits into their own tests, tagged `todo` (rolldown/rolldown#10039)                                                                                                                                                                                                                      | merged 2026-10-09 |
| `dynamic-import`        | #23712 | tags | `test/bundled-dev-skip-tags-dynamic-import`        | un-skips the `vars worker` case (it passes; no tag needed)                                                                                                                                                                                                                                                                   | merged 2026-10-12 |
| `env`                   | #23713 | fix  | `fix/bundled-dev-env-object-define`                | merges user `import.meta.env.*` defines into the `import.meta.env` object (`isBuild` → `isBundled`); removes the skip                                                                                                                                                                                                        | merged 2026-10-13 |
| `environment-react-ssr` | #23740 | tags | `test/bundled-dev-skip-tags-environment-react-ssr` | tags the 2 skips; splits `deps reload` into client (`unsupported`) and ssr (`todo`); makes `basic` assert hydration, tagged `todo`                                                                                                                                                                                           | merged 2026-10-13 |
| `forward-console`       | #23741 | fix  | `fix/bundled-dev-forward-console-sourcemap`        | maps forwarded error stacks through the chunk source maps in `memoryFiles`; removes the 3 skips                                                                                                                                                                                                                              | merged 2026-10-15 |
| `fs-serve`              | #23742 | tags | `test/bundled-dev-skip-tags-fs-serve`              | tags the `matrix` describe as `unsupported` (sapphi-red in #23246: bundled dev does not serve single files); passes the 8.3 skip with `skipIf`, because a `{ skip }` option overrides the tag                                                                                                                                | merged 2026-10-15 |
| `glob-import`           | #23743 | tags | `test/bundled-dev-skip-tags-glob-import`           | tags the 3 add/remove-file HMR tests with one shared `todo` (`globFileAddRemoveTodo`: the `hotUpdate` hook works only for Rolldown's Rust plugins and stays off behind `experimental.devMode.hotUpdate` until the JS-side adapter lands; vitejs/vite#22956, rolldown/rolldown#10065)                                         | merged 2026-10-15 |
| `hmr`                   | #23788 | tags | `test/bundled-dev-skip-tags-hmr`                   | tags 21 of the 26 skips (17 `todo`, 4 `unsupported`); un-skips 5 with no tag; adds a build-error recovery test (`todo`); `css-style/index.html` becomes a build input; `import.meta.hot?.accept` uses `gotoLatestBuild`; splits the link check out of `backend-integration`'s `preserve the base in CSS HMR` (`unsupported`) | open              |

## When I ask you to check the PRs

1. For each row that is not merged, run `gh pr view <number> --repo vitejs/vite --json state,mergedAt,baseRefName`.
2. If a PR is merged:
   - Set its State to `merged <date>` in "PRs per dir".
   - Update the dir's line in the checklist below if it changes (for example, "no tags left").
   - When every test of the dir passes under bundled dev and all of its PRs are merged, shorten its line to `- [x] \`<dir>\` — <N> spec(s) · done`.
   - Check that the next PR in the stack now targets the right base (`main` once everything below it is merged).
3. Update the remote tracking (the two issue comments, see "Issue comments to update"):
   - **Checklist:** take the new numbers from `pnpm run test-serve-bundled playground/<dir>/` and `pnpm run test-serve playground/<dir>/` on an up-to-date `main`. Drop the "with #…" part once those fixes are merged. Check the box only when every remaining gap is by design.
   - **Details:** for a merged fix, change its item from `- [ ]` and "Fix open in #N" to `- [x]` and "Fixed in #N", like the `GET /.env` item under `assets`.
   - Show me the drafts, and post only after I allow it.
4. If a PR was closed without merging, tell me. Do not change anything for it.

## Dirs with bundled-dev skips (25)

Counts are from `main` @ `8a4c19cfc`: 141 skip sites and 5 excluded spec files.

- [x] `assets` — 5 specs · 35 skips · vitejs/vite#23680 · 17 run (bundled-dev branch in the expected value, `runtime-base`) · issue comments: 195/213
- [x] `backend-integration` — 1 spec · done
- [x] `chunk-importmap` — 1 spec · done
- [x] `csp` — 1 spec · 5 skips · vitejs/vite#23705 · issue comments: 4/9 (plain dev 9/9)
- [x] `css` — 6 specs · 1 skip + 4 guards · vitejs/vite#23707 · `tests.ts` is shared by `css.spec.ts` and `lightningcss.spec.ts`, so each tag counts twice · `postcss-plugins-different-dir` starts its own plain dev server (not covered, left as is) · issue comments: 97/107 (10 todo)
- [x] `dynamic-import` — 1 spec · done
- [x] `env` — 1 spec · done
- [x] `environment-react-ssr` — 1 spec · 2 skips + `basic` (never asserted, so it passed without hydration) · vitejs/vite#23740 · `deps reload` split into client and ssr tests · issue comments: 1/5 (plain dev 5/5)
- [x] `forward-console` — 1 spec · done
- [x] `fs-serve` — 3 specs · 1 skip (the `matrix` describe in the shared `commonTests.ts`, about 60 tests per spec) · vitejs/vite#23742 · issue comments: 56/172
- [x] `glob-import` — 1 spec · 3 skips · vitejs/vite#23743 · `no hmr for adding/removing files` passes under bundled dev without checking anything (bundled dev never requests `dir/index.js`), left as is · `follow symlinks same reference` failed locally in every mode on 2026-10-13, also without the change · issue comments: 22/25 (unchanged)
- [x] `hmr` — 1 spec · 26 skips · vitejs/vite#23788 · 21 tagged (17 `todo`, 4 `unsupported`), 5 un-skipped with no tag (`not loaded dynamic import` now edits real code; `css-style/index.html` became a build input; 3 "stray reload" claims did not reproduce) · 1 new test (`restoring a deleted file that is still imported hot updates`, `todo`) · `backend-integration`: the link check of `preserve the base in CSS HMR` split out, `unsupported` with the same reason as the 2 link-swap tests · `import.meta.hot?.accept` now opens its page with `gotoLatestBuild`: after case 15's edit the output is stale, so plain `page.goto` landed on the fallback page and the edit right after it could be dropped (3 failures in 26 runs; 0 in 60 runs with `gotoLatestBuild`) · issue comments: 39/61 (plain dev 61/61)
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
