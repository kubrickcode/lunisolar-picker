import { describe, expect, it, onTestFinished } from 'vitest';
import { resolvePortalContainer } from './portal-container';

const createDialogWithAnchor = (): { readonly anchor: HTMLElement; readonly dialog: HTMLDialogElement } => {
  const dialog = document.createElement('dialog');
  const wrapper = document.createElement('div');
  const anchor = document.createElement('template');
  wrapper.append(anchor);
  dialog.append(wrapper);
  document.body.append(dialog);
  onTestFinished(() => {
    dialog.close();
    dialog.remove();
  });
  return { anchor, dialog };
};

describe('resolvePortalContainer', () => {
  it('returns the nearest dialog opened with showModal', () => {
    const { anchor, dialog } = createDialogWithAnchor();
    dialog.showModal();

    expect(resolvePortalContainer(anchor)).toBe(dialog);
  });

  it('returns body for a dialog opened with show()', () => {
    const { anchor, dialog } = createDialogWithAnchor();
    dialog.show();

    expect(resolvePortalContainer(anchor)).toBe(document.body);
  });

  it('returns body when no dialog contains the anchor', () => {
    const anchor = document.createElement('template');
    document.body.append(anchor);
    onTestFinished(() => anchor.remove());

    expect(resolvePortalContainer(anchor)).toBe(document.body);
  });
});
