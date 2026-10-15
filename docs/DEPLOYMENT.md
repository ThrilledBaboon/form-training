# GitHub Pages deployment

Published at **[FORM](https://thrilledbaboon.github.io/form-training/)** from the public [source repository](https://github.com/ThrilledBaboon/form-training). The first [deployment](https://github.com/ThrilledBaboon/form-training/actions/runs/38800980991) succeeded on 15 October 2026, after [CI verification](https://github.com/ThrilledBaboon/form-training/actions/runs/38800587905) passed.

The workout streak and confirmed data-reset update was [deployed successfully](https://github.com/ThrilledBaboon/form-training/actions/runs/38805692280) on 15 October 2026 after [CI](https://github.com/ThrilledBaboon/form-training/actions/runs/38805197566) passed all 69 unit/storage tests and 48 browser checks. Ten additional checks passed against the live site in Chromium and WebKit, including reset/export/restore and offline logging. See the [verification record](VERIFICATION.md) for scope and limitations.

The **Suggest session** update was [deployed successfully](https://github.com/ThrilledBaboon/form-training/actions/runs/38810274123) on 15 October 2026 after [CI](https://github.com/ThrilledBaboon/form-training/actions/runs/38809759416) passed all 86 unit/storage tests and 57 browser checks. Sixteen targeted checks passed against the hosted site, including the new preview/start/reload/resume flow, rest-day scheduling and first-session baselines.

The latest **library sharing** update was [deployed successfully](https://github.com/ThrilledBaboon/form-training/actions/runs/38816098389) on 15 October 2026 after [CI](https://github.com/ThrilledBaboon/form-training/actions/runs/38815664084) passed all **99 unit/storage tests** and **66 browser checks**. Eight targeted checks passed against the hosted site in Chromium and WebKit, including programme import/start/reload, exercise/routine/programme/library downloads, optional notes/weights, duplicate and invalid-file handling, accessible themes/narrow layouts and offline persistence. Root/assets/manifest/icons/worker and the repository scope were also checked.

`.github/workflows/pages.yml` is manually triggered only; pushing the code runs verification but does not publish an update. To publish changes, push to `main`, wait for **Verify FORM**, then run **Deploy FORM to Pages** on `main`. The recorded hosted checks are in [verification notes](VERIFICATION.md).

## Before publishing

1. Export a JSON backup of any locally recorded workouts. The hosted origin has separate browser data.
2. Review current [GitHub Pages limits and permitted uses](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) and your repository visibility. The website will be publicly reachable; records remain in each visitor's own local database.
3. Verify no personal export, screenshot, reference video, test artefact or secret has been added. `dist`, `node_modules`, `.local` and browser-test outputs are ignored. The committed source contains general exercise templates only.
4. Create/select your repository and push the reviewed code when ready. No credentials are required in frontend source.

## Exact Pages settings

1. Repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repository → **Actions → Deploy FORM to Pages → Run workflow**. Choose the branch containing the app.
3. Approve the `github-pages` deployment environment if repository rules require it.
4. Open the URL reported by the completed deploy job. Do not infer success from a successful local build.

The workflow sets `BASE_PATH` to `/<repository-name>/` for a project site and `/` for a `<owner>.github.io` repository, builds and uploads `dist`. It requests only the Pages deployment permissions. For a custom domain, change `BASE_PATH` to `/` and configure Pages/DNS separately.

The app uses `#/route` navigation, so refreshing a view does not request a nonexistent server-side route. Vite assets, manifest start URL/scope and service worker operate relative to the configured base. The live HTTPS site, repository-prefixed assets and manifest, worker scope (`https://thrilledbaboon.github.io/form-training/`) and offline reload were verified after the first deployment. Repeat the hosted checks after changing the repository name, domain, base path or caching configuration.

## Local production and subpath verification

```sh
pnpm test
BASE_PATH=/form-test/ pnpm build
TEST_SUBPATH=/form-test/ pnpm test:e2e
pnpm build
```

The same production browser suite can run against a repository subpath, including offline reload and active-session recovery. A production build, even with this verification, is not a published deployment.

## Check the published site

- Open the root and `/#/workout` under the repository path; refresh both.
- Confirm assets, manifest and worker return success with the repository prefix.
- Create a test session, log a set, refresh and resume; export JSON.
- Load/reload online until a worker controls the page, then go offline and repeat navigation/logging.
- On your physical phone, verify install-to-home-screen behaviour, virtual keyboard, sounds and wake lock independently. Desktop/mobile Chromium emulation does not prove Safari or native background support.
- Import your local JSON if you want to transfer existing history. Never add that export to Git.

Technical references used: [Vite static deployment](https://vite.dev/guide/static-deploy.html), [Vite base paths](https://vite.dev/guide/build), [Vite PWA strategies](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors), [Dexie transactions](<https://dexie.org/docs/Dexie/Dexie.transaction()>).
