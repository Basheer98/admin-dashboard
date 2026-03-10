# Restore Light Theme

If you want to revert from the VAPI-style dark theme back to the original light theme:

## Best option: Use Git

If you have Git and committed **before** the dark theme was applied:

```bash
git checkout .
```

That reverts all theme changes in one command.

## Fallback: Restore core files only

These backups cover the two most important theme files:

```bash
cd admin-dashboard
cp _theme-backup-light/globals.css app/globals.css
cp _theme-backup-light/SidebarLayout.tsx app/components/SidebarLayout.tsx
```

This restores the main layout, colors, and sidebar. Other pages (forms, tables, etc.) may still use some dark-themed classes (zinc, emerald) until those components are reverted.

## What the backup contains

- `globals.css` – Original light theme CSS
- `SidebarLayout.tsx` – Original sidebar
