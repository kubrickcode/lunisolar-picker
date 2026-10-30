import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { renderWithHydration } from '../testing/expect-hydration';
import { focusOnce } from '../testing/focus-once';
import { showModalDialog } from '../testing/show-modal-dialog';
import * as Sheet from './parts';
import { useSheetContext } from './sheet-context';

const OpenButton = () => {
  const sheet = useSheetContext();
  return (
    <button type="button" onClick={() => sheet.setOpen(true)}>
      Pick a date
    </button>
  );
};

const Example = () => (
  <>
    <main>
      <p>Page content</p>
    </main>
    <Sheet.Root>
      <OpenButton />
      <Sheet.Content aria-label="Birth date">
        <button type="button" data-autofocus>
          Wheel
        </button>
        <Sheet.Close>Done</Sheet.Close>
      </Sheet.Content>
    </Sheet.Root>
  </>
);

const DialogExample = () => (
  <dialog aria-label="Join room">
    <Sheet.Root>
      <OpenButton />
      <Sheet.Content aria-label="Birth date">
        <button type="button" data-autofocus>
          Wheel
        </button>
      </Sheet.Content>
    </Sheet.Root>
  </dialog>
);

const EscapeHandlingExample = () => (
  <Sheet.Root defaultOpen>
    <Sheet.Content aria-label="Birth date">
      <input
        aria-label="Search"
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.preventDefault();
        }}
      />
    </Sheet.Content>
  </Sheet.Root>
);

describe('Sheet', () => {
  it('opens as a modal dialog, focuses the autofocus element, and makes the page inert', async () => {
    const screen = await render(<Example />);

    await screen.getByRole('button', { name: 'Pick a date' }).click();

    const dialog = screen.getByRole('dialog', { name: 'Birth date' });
    await expect.element(dialog).toHaveAttribute('aria-modal', 'true');
    await expect.element(screen.getByRole('button', { name: 'Wheel' })).toHaveFocus();
    expect(screen.container.inert).toBe(true);
    expect(screen.container.getAttribute('aria-hidden')).toBe('true');
  });

  it('closes on Escape, restores inert state, and returns focus to the opener', async () => {
    const screen = await render(<Example />);
    const opener = screen.getByRole('button', { name: 'Pick a date' });
    await focusOnce(opener);
    await userEvent.keyboard('{Enter}');

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    expect(screen.container.inert).toBe(false);
    expect(screen.container.hasAttribute('aria-hidden')).toBe(false);
    await expect.element(opener).toHaveFocus();
  });

  it('keeps the sheet open when a child already handled Escape', async () => {
    const screen = await render(<EscapeHandlingExample />);
    await expect.element(screen.getByRole('textbox', { name: 'Search' })).toBeVisible();
    screen.getByRole('textbox', { name: 'Search' }).element().focus();

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).toBeVisible();
  });

  it('keeps the sheet open while an IME composition is being cancelled with Escape', async () => {
    const screen = await render(<EscapeHandlingExample />);
    await expect.element(screen.getByRole('dialog')).toBeVisible();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    await expect.element(screen.getByRole('dialog')).toBeVisible();
  });

  it('locks scroll, hides siblings, and moves focus when it starts open after hydration', async () => {
    const { container, recoverableErrors, unmount } = await renderWithHydration(
      <>
        <main>
          <p>Page content</p>
        </main>
        <Sheet.Root defaultOpen>
          <Sheet.Content aria-label="Birth date">
            <button type="button" data-autofocus>
              Wheel
            </button>
          </Sheet.Content>
        </Sheet.Root>
      </>,
    );

    expect(recoverableErrors).toEqual([]);
    expect(document.body.style.position).toBe('fixed');
    expect(container.inert).toBe(true);
    await expect.poll(() => document.activeElement?.textContent).toBe('Wheel');

    unmount();
    expect(document.body.style.position).toBe('');
  });

  it('closes when the backdrop is tapped but not when the panel is tapped', async () => {
    const screen = await render(<Example />);
    await screen.getByRole('button', { name: 'Pick a date' }).click();

    screen
      .getByRole('dialog')
      .element()
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect.element(screen.getByRole('dialog')).toBeVisible();

    const backdrop = document.querySelector('[data-lsp-part="sheet-backdrop"]');
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing on the server even when open', () => {
    const html = renderToString(
      <Sheet.Root defaultOpen>
        <Sheet.Content aria-label="Birth date">Body</Sheet.Content>
      </Sheet.Root>,
    );

    expect(html).toBe('');
  });

  it('renders the sheet inside the modal dialog that contains it and keeps it interactive', async () => {
    const screen = await render(<DialogExample />);
    const dialog = showModalDialog(screen.container);

    await screen.getByRole('button', { name: 'Pick a date' }).click();

    await expect.element(screen.getByRole('button', { name: 'Wheel' })).toHaveFocus();
    expect(document.querySelector('[data-lsp-part="sheet-backdrop"]')?.parentElement).toBe(dialog);
    expect(dialog.inert).toBe(false);
  });

  it('keeps rendering at the end of body outside any dialog', async () => {
    const screen = await render(<Example />);

    await screen.getByRole('button', { name: 'Pick a date' }).click();

    await expect.element(screen.getByRole('dialog', { name: 'Birth date' })).toBeVisible();
    expect(document.querySelector('[data-lsp-part="sheet-backdrop"]')?.parentElement).toBe(document.body);
  });

  it('has no accessibility violations while open', async () => {
    const screen = await render(<Example />);
    await screen.getByRole('button', { name: 'Pick a date' }).click();

    await expectNoAxeViolations(screen.getByRole('dialog').element());
  });
});
