# @lunisolar-picker/theme

The Mono theme for lunisolar-picker: monochrome, hairline borders, 8 px radius, light and dark.

```css
@layer theme, base, lunisolar-picker, components, utilities;
@import '@lunisolar-picker/theme/mono.css';
@import '@lunisolar-picker/theme/bridge/shadcn.css'; /* optional: follow shadcn/ui tokens */
```

- Everything lives in `@layer lunisolar-picker`, so your utilities override it without `!important`.
- Dark mode: `.dark` or `[data-theme="dark"]` on `html` or `body`. Follow the OS with `[data-theme="system"]`.
- Tokens: `--lsp-bg`, `--lsp-surface`, `--lsp-fg`, `--lsp-muted`, `--lsp-subtle`, `--lsp-placeholder`, `--lsp-border`, `--lsp-accent`, `--lsp-accent-fg`, `--lsp-range-bg`, `--lsp-ring`, `--lsp-focus`, `--lsp-danger`, `--lsp-shadow-popover`, `--lsp-backdrop`, `--lsp-radius`, `--lsp-cell-size`, `--lsp-wheel-item-size`, `--lsp-wheel-visible-count`, `--lsp-duration`.
