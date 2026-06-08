# Loupe IPA Builder

## Repo strukturu
```
.github/workflows/build.yml   ← GitHub Actions
LoupeApp/                      ← Swift WKWebView wrapper
react-source/                  ← React/Vite app (device fingerprinting)
```

## Necə işlətmək

1. Bu repo-nu GitHub-a push et
2. Actions tab-ına keç → **Build Loupe IPA** → **Run workflow**
3. Build bitəndə **Artifacts** bölməsindən `Loupe-X.ipa` yüklə
4. Sideloadly / AltStore / TrollStore ilə yüklə

## Qeyd
IPA unsigned-dır — öz alətin ilə sign edib yüklə.
