# macOS Quarantine Helper

If an unsigned build shows:

`"dailytrack" is damaged and can’t be opened.`

Use `fix-dailytrack-quarantine.command` after dragging app to `/Applications`.

## Steps

1. Install `dailytrack.app` to `/Applications`.
2. Run `fix-dailytrack-quarantine.command`.
3. Launch app again.

Optional custom app path:

```bash
./fix-dailytrack-quarantine.command "/path/to/dailytrack.app"
```
