# App Icon Source

`dailytrack.png` is the raw brand logo.
`dailytrack-app-icon.png` is the default app icon source (used for desktop/mobile launcher icons).
`dailytrack-android-bg.png` is the Android adaptive background source.
`dailytrack-android-fg.png` is the Android adaptive foreground source.

When you update the logo, regenerate platform icons with the manifest:

```bash
npm run icon:generate
```

This updates desktop/mobile icon variants (including Android launcher assets).
