import { ko } from '@lunisolar-picker/core/locales/ko';
import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { BirthDateForm } from './BirthDateForm';

describe('BirthDateForm with react-hook-form', () => {
  it('submits the initial date string unchanged', async () => {
    const onSubmitValues = vi.fn();
    await render(<BirthDateForm onSubmitValues={onSubmitValues} />);

    await page.getByRole('button', { name: '제출' }).click();

    expect(onSubmitValues).toHaveBeenCalledWith({ birthDate: '1990-03-15' });
  });

  it('turns a cleared picker into null and blocks submit with the required message', async () => {
    const onSubmitValues = vi.fn();
    await render(<BirthDateForm onSubmitValues={onSubmitValues} />);

    await page.getByRole('button', { name: ko.labels.clear }).click();
    await page.getByRole('button', { name: '제출' }).click();

    expect(onSubmitValues).not.toHaveBeenCalled();
    await expect.element(page.getByRole('alert')).toHaveTextContent('생년월일을 입력하세요');
  });

  it('accepts a date typed digit by digit after clearing', async () => {
    const onSubmitValues = vi.fn();
    await render(<BirthDateForm onSubmitValues={onSubmitValues} />);

    await page.getByRole('button', { name: ko.labels.clear }).click();
    await page.getByRole('spinbutton', { name: ko.labels.year }).click();
    await userEvent.keyboard('19900315');
    await page.getByRole('button', { name: '제출' }).click();

    expect(onSubmitValues).toHaveBeenCalledWith({ birthDate: '1990-03-15' });
  });
});
