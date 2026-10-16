# bundled-dev

Performance of Vite bundled dev (`vite --experimentalBundle`) compared with Vite dev (`vite`) on real open-source apps.

## Development

This repository is a pnpm workspace managed with [Vite+](https://viteplus.dev/). Use Node.js 24 and run these commands from the repository root:

```sh
pnpm install
pnpm dev        # dashboard in bundled dev
pnpm dev:plain  # dashboard in plain dev
pnpm check      # format, lint and type checks across the repository
pnpm build      # build workspace apps
pnpm preview    # preview the dashboard production build
```

With the global `vp` CLI, use `vp install`, `vp check`, `vp run dev`, and `vp run build`. The root `vite.config.ts` provides shared checks and selects `site/` as the default app for built-in commands. `vp dev` starts plain dev; `vp run dev` runs the bundled-dev script. Without the global CLI, use `pnpm exec vp`.

- `site/` (`@bundled-dev/site`): the compatibility dashboard and its Void deployment config.
- `tldraw/` (`@bundled-dev/tldraw`): benchmark scripts, with workspace tasks for `bench`, `bench:rounds`, `summarize`, and `render`.
- `scripts/`: the upstream Vite test reporter and result comparison. Run `pnpm compare <bundled.json> <plain.json> <build.json> <results dir>`.

The root lockfile and `pnpm-workspace.yaml` own dependency versions and patches. Recorded results and benchmark data are excluded from formatting. The nightly workflow checks out Vite separately in `vite/` and uses its own toolchain; it is excluded from this workspace and its checks. Both GitHub Actions workflows use `voidzero-dev/setup-vp` to set up the runtime and package manager.

| App                    | Folder                        | Vite  | rolldown                               |
| ---------------------- | ----------------------------- | ----- | -------------------------------------- |
| tldraw `apps/examples` | [`tldraw/`](tldraw/README.md) | 8.3.3 | `c532f8106` (1.2.12 + #11127 + #11126) |

## Test compatibility dashboard

[`site/`](site/README.md) is a site that shows how many of Vite's playground tests that apply to bundled dev pass in bundled dev. A nightly workflow runs the tests, commits the results to `results/` and deploys the site.
