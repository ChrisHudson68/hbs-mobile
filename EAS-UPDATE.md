# EAS Update (OTA) runbook — HBS Mobile

Over-the-air JS/asset updates via `expo-updates` (installed, v29). Lets us ship JS-only
fixes without an App Store / Play review, as long as the **native runtime is unchanged**.

## One-time setup (not yet done — requires the EAS project)

```bash
eas update:configure      # links the project + writes expo.updates.url + extra.eas.projectId
```

This is the only missing piece: channels and `runtimeVersion` are already in `eas.json` /
`app.json`; `update:configure` fills in the project-linked `updates.url`. Run it once with
the Hudson EAS account, then commit the generated `app.json` additions.

## Channels ↔ build profiles (configured in `eas.json`)

| Build profile | Channel       | Audience                         |
|---------------|---------------|----------------------------------|
| development   | `development` | dev client                       |
| preview       | `preview`     | internal testers (staging)       |
| production    | `production`  | App Store / Play release         |

## runtimeVersion

`app.json` → `runtimeVersion: { "policy": "appVersion" }`. An OTA update only reaches a build
whose runtimeVersion matches. **Bump the native `version` (and rebuild/submit) whenever you add
or change a native module** (new pod / Gradle dep) — those cannot ship over the air.

## Shipping an update

```bash
# JS/asset-only change on the current branch:
eas update --channel preview     --message "fix: <what changed>"   # test on internal first
eas update --channel production  --message "fix: <what changed>"   # promote to prod
```

## Rollback

```bash
eas update:rollback --channel production    # reverts the channel to the previous update
# or republish a known-good commit:
git checkout <good-sha> -- . && eas update --channel production --message "rollback to <sha>"
```

## When OTA is NOT allowed (must build + submit)

- Any new/updated native module (e.g. a new pod, `@shopify/flash-list`'s native side, MMKV).
- `app.json` native config changes (permissions, plugins, bundle id).
- An expo-updates / SDK upgrade.

In those cases bump `version`, run `npm run ios` / `eas build`, and submit.
