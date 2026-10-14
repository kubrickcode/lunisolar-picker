import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { expectNoAxeViolations } from '../testing/expect-accessible';
import { renderElement } from './render-element';

type PartProps = { readonly render?: Parameters<typeof renderElement>[1] };

const Part = ({ render: renderProp }: PartProps): ReactElement =>
  renderElement(
    'button',
    renderProp,
    { type: 'button', className: 'part', 'data-lsp-part': 'popover-trigger', children: 'Open' },
    { isOpen: false },
  );

describe('renderElement', () => {
  it('renders the default tag with the part props', async () => {
    const screen = await render(<Part />);

    await expect
      .element(screen.getByRole('button', { name: 'Open' }))
      .toHaveAttribute('data-lsp-part', 'popover-trigger');
    await expectNoAxeViolations(screen.container);
  });

  it('merges part props into an element passed as render', async () => {
    const screen = await render(<Part render={<a href="#chip" className="chip" />} />);
    const link = screen.getByRole('link', { name: 'Open' });

    await expect.element(link).toHaveClass('part');
    await expect.element(link).toHaveClass('chip');
  });

  it('lets a render function build the element from props and state', async () => {
    const screen = await render(
      // as: renderElement의 render 매개변수는 props·state를 unknown 계열로 받으므로 테스트에서 실제 모양을 지정
      <Part
        render={(props, state) => (
          <span {...(props as object)} data-open={String((state as { isOpen: boolean }).isOpen)} />
        )}
      />,
    );

    await expect.element(screen.getByText('Open')).toHaveAttribute('data-open', 'false');
  });
});
