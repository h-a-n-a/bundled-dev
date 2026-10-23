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
- A tag cannot cancel `runIf` or `test.skip`. Turn `runIf(isServe && !isBundledDev)` into `runIf(isServe)` + tag. This works only for a `todo` tag. A test-level `runIf` or `skipIf` gives the test `skip: false`, which cancels an `unsupported` tag. For an `unsupported` tag, use `describe.runIf(isServe)` around the test, or add `skip` to the options yourself: `{ ...tag, ...(isBuild ? { skip: true } : {}) }`.
- A guard inside a test (`if (isBundled) return`, `if (!isBundledDev) { … }`, or similar) hides part of the test under bundled dev without a tag, so the report does not show the gap. Split the guarded part into its own test, placed right after the original, and tag it.
  - Name it after the original, plus what the split part checks (e.g. `linked css HMR`).
  - If the guard also covers build (`isBundled`), add `runIf(isServe)` to the new test. For an `unsupported` tag, see the note above.
  - Example: `css` (vitejs/vite#23707).
- A bundled-dev branch in the expected value (`isBundled ? /base64/ : '/nested/icon.png'`) is not a guard. Keep it, with no tag.
- Never tag a block that is limited to another mode: a `todo` tag wins over `describe.runIf(false)`.
- A whole excluded file becomes `/** @module-tag … */`. If build excludes the same file for the same cause in Rolldown, extend build's exclude to `isBundled` (build or bundled dev) instead. Example: `object-hooks`.
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

## `optimize-deps` triage

The whole `optimize-deps` spec is `unsupported` under bundled dev. Go through its test cases one by one, so that a bundled-dev bug in one of them is not lost.

To run a case under bundled dev, remove `skip: isBundledDev` from `clientOptimizerUnsupported` in `optimize-deps.spec.ts` on your machine only. Do not commit that change.

```sh
pnpm run test-serve-bundled playground/optimize-deps/ -t "<test name>"
```

For each test case:

1. Find out whether it fails or passes under bundled dev.
2. If it fails because it needs the dep optimizer, find out which part needs it:
   - The behavior it checks is the optimizer itself (its metadata, its config, its logs): do nothing else. Tick it and move on.
   - Only the setup needs it, but the behavior it checks also exists under bundled dev. For example, a fixture plugin matches `.vite/deps` ids, but the code it adds can appear in any bundle (`dep-with-injected-import`). A bug in that behavior would stay hidden, so:
     1. On your machine only, change the setup so that it works without the optimizer, the way bundled dev handles that code. Keep the behavior the same.
     2. Run the case again, and go to step 3 or 4 with the result.
3. If it fails because of a bug in bundled dev:
   - Before copying, search the other playgrounds for a test that already covers the same behavior. If one exists, use it and do not copy.
   - Copy the case to a different playground. Show me a draft of the copy first. This keeps the failure tracked, and decouples it from `optimize-deps`.
   - Make the copy right away, even when a fix is in progress. Tag it `todo`, and remove the tag once the fix is released in Vite. In the second argument, put the tracking issue, or the fix PR when there is no issue. Example: vitejs/vite#23877, made before rolldown/rolldown#11020 landed.
   - Then compare the copy with the original in `optimize-deps`:
     - If they are identical (in plain dev, the copy also runs the same dep optimizer code), remove the original from `optimize-deps`, in the same PR as the copy. Example: the dynamic-import cases in vitejs/vite#23877.
     - If the original also checks something that only `optimize-deps` gives it (its config, its metadata, a real package that the copy replaces in a way that matters), keep the original.
   - Add a row to "Bundled-dev bugs found in `optimize-deps`".
   - Update both issue comments for the new case (see "Issue comments to update"): the playground's line in the checklist, and its gap in the details.
   - Until the copy is tagged, keep the case unticked and add a note after it: ` — bundled-dev bug · fix in <PR> · <what is left>`.
   - Once the copy is tagged (`todo` or `unsupported`), tick the case here.
4. If it passes, tick it and move on.

- [x] `default + named imports from cjs dep (react)`
- [x] `named imports from webpacked cjs (phoenix)`
- [x] `default import from webpacked cjs (clipboard)`
- [x] `default import from cjs with es-module-flag (dep-cjs-with-es-module-flag)`
- [x] `default import from cjs (cjs-dep-cjs-compiled-from-esm)`
- [x] `default import from cjs (cjs-dep-cjs-compiled-from-cjs)`
- [x] `named import injected into an optimized dep by a plugin (dep-with-injected-import)`
- [x] `dynamic imports from cjs dep (react)`
- [x] `dynamic named imports from webpacked cjs (phoenix)`
- [x] `dynamic default import from webpacked cjs (clipboard)`
- [x] `dynamic default import from cjs (cjs-dynamic-dep-cjs-compiled-from-esm)`
- [x] `dynamic default import from cjs (cjs-dynamic-dep-cjs-compiled-from-cjs)`
- [x] `dynamic default import from cjs with es-module-flag (cjs-dynamic-dep-cjs-with-es-module-flag)`
- [x] `dynamic import from format-ambiguous importer respects __esModule flag (cjs-dynamic-importer-ambiguous)`
- [x] `dynamic import from explicit cjs importer uses node interop (cjs-dynamic-importer-cjs)`
- [x] `dedupe`
- [x] `cjs browser field (axios)`
- [x] `cjs browser field bare`
- [x] `dep from linked dep (lodash-es)`
- [x] `forced include`
- [x] `import * from optimized dep`
- [x] `import from dep with process.env.NODE_ENV`
- [x] `import from dep with .notjs files`
- [x] `Import from dependency which uses relative path which needs to be resolved by main field`
- [x] `dep with dynamic import`
- [ ] `dep with optional peer dep` — bundled-dev bug · fix in rolldown/rolldown#11276 · copy it to `resolve`
- [ ] `dep with optional peer dep submodule` — bundled-dev bug · fix in rolldown/rolldown#11276 · copy it to `resolve`
- [x] `dep with optional peer dep (cjs)`
- [ ] `optimized CJS dep preserves fallback for excluded optional peer`
- [x] `dep with css import`
- [x] `CJS dep with css import`
- [x] `CJS dep requiring dep with css main field`
- [x] `externalize known non-js files in optimize included dep`
- [x] `vue + vuex`
- [ ] `esbuild-plugin`
- [x] `import from hidden dir`
- [x] `import optimize-excluded package that imports optimized-included package`
- [x] `import aliased package with colon`
- [x] `import aliased package using absolute path`
- [x] `variable names are reused in different scripts`
- [x] `flatten id should generate correctly`
- [x] `non optimized module is not duplicated`
- [x] `optimized browser:false is empty without warning`
- [ ] `error on builtin modules usage`
- [ ] `pre bundle css require`
- [ ] `no missing deps during build`
- [ ] `name file limit is 170 characters`
- [ ] `optimizeDeps config > supports include glob syntax`
- [x] `long file name should work`
- [ ] `warn on incompatible dependency`
- [x] `import the CommonJS external package that omits the js suffix`
- [ ] `external package name with asset extension`
- [ ] `dependency with external sub-dependencies`
- [x] `discovers deep imports with custom html-like extensions during dep scan`
- [x] `virtual module with .vue extension does not error during scan`
- [x] `no dep scan error for virtual modules with html-like extensions`
- [ ] `should fix relative worker paths in optimized dependencies`

### Bundled-dev bugs found in `optimize-deps`

One row per bug found during triage. What breaks, its priority and its effort belong in the Details comment, not here.

| Bug                                                             | Found by                                                                                             | Copied to                                                                                                              | PRs                                        | State                                           |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| A named import from a Node built-in fails with `MISSING_EXPORT` | the whole page: `import { Buffer } from 'buffer'` in `index.html`, and `dep-with-builtin-module-esm` | `resolve`: `named import from a Node built-in does not break the build`, `reading a named import from a Node built-in` | vitejs/vite#23858, rolldown/rolldown#11260 | #23858 waits for a Rolldown release with #11260 |
| Lazy compilation loses the `default` export of a dynamically imported CommonJS module (vitejs/vite#23558) | the 6 failing dynamic-import cases: `react`, `clipboard`, `cjs-dynamic-dep-cjs-compiled-from-esm`, `cjs-dynamic-dep-cjs-compiled-from-cjs`, `cjs-dynamic-dep-cjs-with-es-module-flag`, `cjs-dynamic-importer-cjs` | `dynamic-import`: the `dynamic import of a CommonJS dep` describe (6 tests, `todo`; small local fixtures replace `react` and `clipboard`) | vitejs/vite#23877 (tests), rolldown/rolldown#11020 (fix) | #23877 open (draft); remove the `todo` once #11020 is released in Vite |
| An `import()` of an optional peer dep that is not installed is left as an external import, so the browser cannot load it (`Failed to resolve module specifier '__vite-optional-peer-dep:…'`). Lazy compilation resolves the first resolve result again, and no plugin resolves that id. A `\0` virtual module imported only through `import()` breaks the same way | `dep with optional peer dep`, `dep with optional peer dep submodule` | not copied yet | rolldown/rolldown#11276 (fix, stacked on rolldown/rolldown#11000) | fix in progress; #11276 is a draft and waits for #11000; the Vite copy is next |

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
  - A dir with no gaps left (every skip is `unsupported`) gets no section: the checked box in the checklist already says it is done.
  - A by-design case that already has an item keeps it. Reword the item to "Marked as expected in #N" (the PR that decided it) plus the tag PR. Never write "Fixed in #N" for a case that is by design, and do not delete the section.
  - Each gap lists: what breaks, its tests, the code location if known, the tracking issue (or "No issue yet"), and the effort.
  - Update the counts, causes and test lists that this dir's work changed. Leave out test-only fixes (a bundled-dev branch in the expected value), because they are not gaps.

## PRs per dir

Only PRs opened as part of this work, starting with #23680. The vitejs/vite PRs form one stack, in table order: each one targets the branch of the row above it. A Rolldown PR that a Vite PR needs is listed by its full name (`rolldown/rolldown#N`), right after that Vite PR. It is not part of the stack.

| Dir                     | PR                      | Kind | Branch                                             | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                              | State             |
| ----------------------- | ----------------------- | ---- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `assets`                | #23680                  | tags | `test/bundled-dev-skip-tags`                       | tags the 35 skips; adds `meta.issues` to the helpers                                                                                                                                                                                                                                                                                                                                                                                                      | merged 2026-10-09 |
| `backend-integration`   | #23681                  | tags | `test/bundled-dev-skip-tags-backend-integration`   | tags the 6 skips; Windows-only `todo` (`windowsTodo`)                                                                                                                                                                                                                                                                                                                                                                                                     | merged 2026-10-09 |
| `backend-integration`   | #23683                  | fix  | `fix/bundled-dev-server-origin`                    | applies `server.origin` to asset URLs; removes 2 `todo`                                                                                                                                                                                                                                                                                                                                                                                                   | merged 2026-10-09 |
| `backend-integration`   | #23684                  | fix  | `fix/bundled-dev-windows-file-names`               | normalizes memory-file keys (`\` on Windows); removes `windowsTodo`                                                                                                                                                                                                                                                                                                                                                                                       | merged 2026-10-09 |
| `chunk-importmap`       | #23685                  | fix  | `fix/bundled-dev-chunk-import-map`                 | bundled dev ignores `build.chunkImportMap`; removes the exclude entry                                                                                                                                                                                                                                                                                                                                                                                     | merged 2026-10-09 |
| `csp`                   | #23705                  | tags | `test/bundled-dev-skip-tags-csp`                   | tags the 5 skips with one shared `todo` (`transformIndexHtmlTodo`)                                                                                                                                                                                                                                                                                                                                                                                        | merged 2026-10-09 |
| `css`                   | #23707                  | tags | `test/bundled-dev-skip-tags-css`                   | tags `?url` as `todo`; splits 4 HMR edits into their own tests, tagged `todo` (rolldown/rolldown#10039)                                                                                                                                                                                                                                                                                                                                                   | merged 2026-10-09 |
| `dynamic-import`        | #23712                  | tags | `test/bundled-dev-skip-tags-dynamic-import`        | un-skips the `vars worker` case (it passes; no tag needed)                                                                                                                                                                                                                                                                                                                                                                                                | merged 2026-10-12 |
| `env`                   | #23713                  | fix  | `fix/bundled-dev-env-object-define`                | merges user `import.meta.env.*` defines into the `import.meta.env` object (`isBuild` → `isBundled`); removes the skip                                                                                                                                                                                                                                                                                                                                     | merged 2026-10-13 |
| `environment-react-ssr` | #23740                  | tags | `test/bundled-dev-skip-tags-environment-react-ssr` | tags the 2 skips; splits `deps reload` into client (`unsupported`) and ssr (`todo`); makes `basic` assert hydration, tagged `todo`                                                                                                                                                                                                                                                                                                                        | merged 2026-10-13 |
| `forward-console`       | #23741                  | fix  | `fix/bundled-dev-forward-console-sourcemap`        | maps forwarded error stacks through the chunk source maps in `memoryFiles`; removes the 3 skips                                                                                                                                                                                                                                                                                                                                                           | merged 2026-10-15 |
| `fs-serve`              | #23742                  | tags | `test/bundled-dev-skip-tags-fs-serve`              | tags the `matrix` describe as `unsupported` (sapphi-red in #23246: bundled dev does not serve single files); passes the 8.3 skip with `skipIf`, because a `{ skip }` option overrides the tag                                                                                                                                                                                                                                                             | merged 2026-10-15 |
| `glob-import`           | #23743                  | tags | `test/bundled-dev-skip-tags-glob-import`           | tags the 3 add/remove-file HMR tests with one shared `todo` (`globFileAddRemoveTodo`: the `hotUpdate` hook works only for Rolldown's Rust plugins and stays off behind `experimental.devMode.hotUpdate` until the JS-side adapter lands; vitejs/vite#22956, rolldown/rolldown#10065)                                                                                                                                                                      | merged 2026-10-15 |
| `hmr`                   | #23788                  | tags | `test/bundled-dev-skip-tags-hmr`                   | tags 20 of the 26 skips (17 `todo`, 3 `unsupported`); un-skips 6 with no tag (`delete file should not break hmr` asserts the bundled-dev values, and its fixture removes the click listener in `dispose`); adds a build-error recovery test (`todo`); `css-style/index.html` becomes a build input; `import.meta.hot?.accept` uses `gotoLatestBuild`; splits the link check out of `backend-integration`'s `preserve the base in CSS HMR` (`unsupported`) | merged 2026-10-16 |
| `js-sourcemap`          | #23796                  | tags | `test/bundled-dev-skip-tags-js-sourcemap`          | tags the 5 skips as `unsupported`: 2 share the `fs-serve` single-file reason, 3 share the `environment-react-ssr` dep-optimizer reason                                                                                                                                                                                                                                                                                                                    | merged 2026-10-20 |
| `json`                  | #23801                  | tags | `test/bundled-dev-skip-tags-json`                  | tags `fetch` as `unsupported` with the `fs-serve` single-file reason                                                                                                                                                                                                                                                                                                                                                                                      | merged 2026-10-21 |
| `legacy`                | #23831                  | tags | `test/bundled-dev-skip-tags-legacy`                | un-skips `import.meta.env.LEGACY` (fixed by #23713) and removes the `legacy-chunk-importmap.spec.ts` exclude entry (fixed by #23685); no tags                                                                                                                                                                                                                                                                                                             | merged 2026-10-21 |
| `object-hooks`          | #23835                  | tags | `test/bundled-dev-skip-tags-object-hooks`          | moves `object-hooks.spec.ts` from `bundledDevExclude` to build's exclude, which now applies to `isBundled` (Rolldown runs parallel hooks such as `buildStart` one at a time)                                                                                                                                                                                                                                                                              | merged 2026-10-21 |
| `optimize-deps`         | #23857                  | tags | `test/bundled-dev-skip-tags-optimize-deps`         | marks the whole spec as `unsupported` (one `describe` with the tag, the reason, and `skip: isBundledDev`, because a test-level `runIf(isServe)` cancels a tag's skip); removes the `bundledDevExclude` entry                                                                                                                                                                                                                                              | merged 2026-10-21 |
| `optimize-deps`         | #23858                  | fix  | `fix/bundled-dev-browser-external-cjs`             | bundled environments get the CommonJS stub for Node built-ins (`isBuild: options.isBuild \|\| partialEnv.config.isBundled`), so a named import such as `import { readFileSync } from 'node:fs'` no longer fails with `MISSING_EXPORT`; adds two `resolve` playground tests                                                                                                                                                                                | open              |
| `optimize-deps`         | rolldown/rolldown#11260 | fix  | `fix/vite-resolve-is-bundled`                      | adds an `isBundled` resolve option to Rolldown's Vite resolve plugin. It picks the CommonJS stub for Node built-ins in place of `isBuild`, so #23858 can pass `isBundled` and keep `isBuild` for build-only behavior                                                                                                                                                                                                                                      | open              |
| `optimize-deps`         | #23877                  | tags | `test/bundled-dev-lazy-cjs-dynamic-import`         | copies the 6 dynamic-import cases that fail under bundled dev into `dynamic-import`, with small local CJS fixtures in place of `react` and `clipboard`; one `describe` tagged `todo` (vitejs/vite#23558, fixed by rolldown/rolldown#11020); also moves the 2 passing dynamic-import cases (the ambiguous CJS importer, and phoenix as a small ESM dep) with no tag; removes all 8 originals from `optimize-deps`, because the copies run the same optimizer interop in plain dev. Based on `main`, not on the row above | open              |
| `optimize-deps`         | rolldown/rolldown#11276 | fix  | `fix-lazy-keep-resolved-id`                        | the lazy compilation plugin keeps the first resolve result of each lazy entry and reuses it when the fetched proxy imports the real module, so ids that do not resolve to themselves (`\0` virtual ids, `__vite-optional-peer-dep:…`) are not left external. Stacked on rolldown/rolldown#11000, not on `main` | open (draft) |

## When I ask you to check the PRs

1. For each row that is not merged, run `gh pr view <number> --repo vitejs/vite --json state,mergedAt,baseRefName`.
2. If a PR is merged:
   - Set its State to `merged <date>` in "PRs per dir".
   - Update the dir's line in the checklist below if it changes (for example, "no tags left").
   - When every skip of the dir is tagged or removed and all of its PRs are merged, shorten its line to ``- [x] `<dir>` — <N> spec(s) · done``. Remaining `todo` or `unsupported` tags do not matter here. This is different from the issue checklist, which checks the box only when every remaining gap is by design.
   - Check that the next PR in the stack now targets the right base (`main` once everything below it is merged).
3. Update the remote tracking (the two issue comments, see "Issue comments to update"):
   - **Checklist:** take the new numbers from `pnpm run test-serve-bundled playground/<dir>/` and `pnpm run test-serve playground/<dir>/` on an up-to-date `main`. Drop the "with #…" part once those fixes are merged. Check the box only when every remaining gap is by design.
   - **Details:** for a merged fix, change its item from `- [ ]` and "Fix open in #N" to `- [x]` and "Fixed in #N", like the `GET /.env` item under `assets`.
   - Show me the drafts, and post only after I allow it.
4. If a PR was closed without merging, tell me. Do not change anything for it.

## Dirs with bundled-dev skips (23)

Counts are from `main` @ `8a4c19cfc`: 141 skip sites and 5 excluded spec files.

- [x] `assets` — 5 specs · done
- [x] `backend-integration` — 1 spec · done
- [x] `chunk-importmap` — 1 spec · done
- [x] `csp` — 1 spec · done
- [x] `css` — 6 specs · done
- [x] `dynamic-import` — 1 spec · done
- [x] `env` — 1 spec · done
- [x] `forward-console` — 1 spec · done
- [x] `fs-serve` — 3 specs · done
- [x] `glob-import` — 1 spec · done
- [x] `hmr` — 1 spec · done
- [x] `js-sourcemap` — 1 spec · done
- [x] `json` — 1 spec · done
- [x] `legacy` — 8 specs · done
- [x] `object-hooks` — 1 spec · done
- [x] `optimize-deps` — 1 spec · vitejs/vite#23857 · the whole spec is `unsupported` · each test case is triaged in "`optimize-deps` triage" above
- [ ] `optimize-deps-no-discovery` — 1 spec · 1 skip
- [ ] `resolve` — 3 specs · 1 skip
- [ ] `tailwind` — 1 spec · 4 skips
- [ ] `tailwind-v3` — 1 spec · 3 skips
- [ ] `transform-plugin` — 2 specs · 1 skip
- [ ] `tsconfig-json-load-error` — 1 spec · 2 skips (+1 bundled-dev-only test)
- [ ] `worker` — 7 specs · 40 skips

## Dirs with no bundled-dev skip (40)

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
- [ ] `tailwind-sourcemap` — 1 spec
- [ ] `tsconfig-json` — 1 spec
- [ ] `wasm` — 1 spec

## SSR dirs (12)

Dirs whose name contains `ssr`, the same rule the dashboard uses for its SSR scope.

With bundled-dev skips:

- [x] `environment-react-ssr` — 1 spec · done
- [ ] `hmr-ssr` — 1 spec · excluded: `hmr-ssr.spec.ts`

With no bundled-dev skip. Check each one for skips that use another form, as above:

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

## Not test dirs

- `devtools` — manual playground, no tests
- `resolve-linked` — linked dep used by other playgrounds
