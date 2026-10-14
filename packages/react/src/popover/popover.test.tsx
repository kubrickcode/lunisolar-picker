import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import * as Popover from './parts';

const Example = ({ isOpenInitially = false }: { isOpenInitially?: boolean }) => (
  <>
    <button type="button">Outside</button>
    <Popover.Root defaultOpen={isOpenInitially}>
      <Popover.Trigger>Choose date</Popover.Trigger>
      <Popover.Content aria-label="Calendar">
        <button type="button">First</button>
        <button type="button" data-autofocus>
          Selected day
        </button>
        <Popover.Close>Close</Popover.Close>
      </Popover.Content>
    </Popover.Root>
  </>
);

const ControlledExample = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <output>{String(isOpen)}</output>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger>Choose date</Popover.Trigger>
        <Popover.Content aria-label="Calendar">
          <button type="button">Inside</button>
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

describe('Popover', () => {
  it('opens from the trigger and focuses the autofocus element', async () => {
    const screen = await render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose date' });

    await trigger.click();

    await expect.element(screen.getByRole('dialog', { name: 'Calendar' })).toBeVisible();
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect.element(screen.getByRole('button', { name: 'Selected day' })).toHaveFocus();
  });

  it('keeps Tab focus inside the content', async () => {
    const screen = await render(<Example isOpenInitially />);
    await expect.element(screen.getByRole('button', { name: 'Selected day' })).toHaveFocus();
    // WebKit의 기본 Tab은 버튼을 건너뛰므로 트랩이 직접 처리하는 가장자리(마지막 요소)에서 시작함
    screen.getByRole('button', { name: 'Close' }).element().focus();

    await userEvent.keyboard('{Tab}');

    await expect.element(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const screen = await render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose date' });
    await trigger.click();
    await expect.element(screen.getByRole('button', { name: 'Selected day' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await expect.element(trigger).toHaveFocus();
  });

  it('closes when the pointer goes down outside', async () => {
    const screen = await render(<Example />);
    await screen.getByRole('button', { name: 'Choose date' }).click();

    await screen.getByRole('button', { name: 'Outside' }).click();

    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from the close part and restores focus', async () => {
    const screen = await render(<Example />);
    const trigger = screen.getByRole('button', { name: 'Choose date' });
    await trigger.click();

    await screen.getByRole('button', { name: 'Close' }).click();

    await expect.element(trigger).toHaveFocus();
  });

  it('follows a controlled open state', async () => {
    const screen = await render(<ControlledExample />);

    await screen.getByRole('button', { name: 'Choose date' }).click();

    await expect.element(screen.getByRole('status')).toHaveTextContent('true');
    await expect.element(screen.getByRole('dialog')).toBeVisible();
  });

  it('has no accessibility violations while open', async () => {
    const screen = await render(<Example isOpenInitially />);
    await expect.element(screen.getByRole('dialog')).toBeVisible();

    await expectNoAxeViolations(document.body);
  });
});
