---
"@lunisolar-picker/react": patch
---

Sheets and popovers opened from inside a modal `<dialog>` (opened with `showModal()`) now render inside that dialog, so they appear above it and respond to pointer and keyboard input. Escape closes only the picker and leaves the dialog open.
