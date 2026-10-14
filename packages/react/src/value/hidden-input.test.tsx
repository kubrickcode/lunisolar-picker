import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { HiddenInput } from './hidden-input';

describe('HiddenInput', () => {
  it('submits the value under the given name', async () => {
    const screen = await render(
      <form aria-label="Booking">
        <HiddenInput name="checkIn" value="2026-10-14" onFocusRequest={vi.fn()} />
      </form>,
    );
    const form = screen.getByRole('form').element() as HTMLFormElement; // as: getByRole('form')로 찾은 form 요소

    expect(new FormData(form).get('checkIn')).toBe('2026-10-14');
  });

  it('blocks native form validation while a required value is empty', async () => {
    const screen = await render(
      <form aria-label="Booking">
        <HiddenInput name="checkIn" value="" required onFocusRequest={vi.fn()} />
      </form>,
    );

    // as: getByRole('form')로 찾은 form 요소
    expect((screen.getByRole('form').element() as HTMLFormElement).checkValidity()).toBe(false);
  });

  it('hands focus to the visible field when the browser focuses it for a validation message', async () => {
    const onFocusRequest = vi.fn();
    const screen = await render(
      <form aria-label="Booking">
        <HiddenInput name="checkIn" value="" required onFocusRequest={onFocusRequest} />
      </form>,
    );

    (screen.container.querySelector('input') as HTMLInputElement).focus(); // as: 바로 위에서 그린 input 하나

    expect(onFocusRequest).toHaveBeenCalledOnce();
  });

  it('renders nothing without a name', async () => {
    const screen = await render(<HiddenInput value="2026-10-14" onFocusRequest={vi.fn()} />);

    expect(screen.container.querySelector('input')).toBeNull();
  });
});
