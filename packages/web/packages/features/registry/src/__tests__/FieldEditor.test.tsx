import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldEditor } from '../editors/FieldEditor';
import { FIELD_TYPES } from '@agenticdevelopertoolkit/registry-types';
import type { FieldType } from '@agenticdevelopertoolkit/registry-types';

const def = (type: FieldType, config: Record<string, unknown> = {}) => ({
  key: 'f', type, required: false, config, label: 'A field',
});

// The bug this table exists to catch: FieldEditor's switch (editors/FieldEditor.tsx) falls
// through to a `default:` case that renders a plain `input[type="text"]` — the exact same
// element `text` (and `image`, and every other simple type) renders on purpose. A generic
// "some input/textarea/select/group exists" assertion cannot tell a deliberate text-like
// fallback from a genuinely unhandled type silently landing on it; it is satisfied either
// way, so a type added to the catalog with no real case can never fail it. Asserting the
// SPECIFIC control each type's own case produces closes that: `Record<FieldType, ...>`
// requires an entry for every type FieldEditor is supposed to handle, so a new catalog type
// with no matching case here is a missing map key — a `tsc` error from the package's own
// `lint` script, and if that is bypassed, a thrown TypeError the moment the loop below
// reaches it, either way an actual test failure rather than a silent pass.
const CONTROL_CHECK: Record<FieldType, (container: HTMLElement) => void> = {
  text: (c) =>
    expect(c.querySelector('input[type="text"]:not([placeholder])'), 'text: expected a plain text input').not.toBeNull(),
  textarea: (c) =>
    expect(c.querySelector('textarea[rows="4"]'), 'textarea: expected a 4-row textarea').not.toBeNull(),
  markdown: (c) =>
    expect(c.querySelector('textarea[rows="10"]'), 'markdown: expected a 10-row textarea').not.toBeNull(),
  select: (c) => expect(c.querySelector('select'), 'select: expected a <select>').not.toBeNull(),
  multi_select: (c) => {
    const group = c.querySelector('[role="group"]');
    expect(group, 'multi_select: expected a role="group" container').not.toBeNull();
    expect(
      group?.querySelectorAll('input[type="checkbox"]').length,
      'multi_select: expected checkboxes inside the group',
    ).toBeGreaterThan(0);
  },
  url: (c) => expect(c.querySelector('input[type="url"]'), 'url: expected an input[type="url"]').not.toBeNull(),
  email: (c) =>
    expect(c.querySelector('input[type="email"]'), 'email: expected an input[type="email"]').not.toBeNull(),
  phone: (c) => expect(c.querySelector('input[type="tel"]'), 'phone: expected an input[type="tel"]').not.toBeNull(),
  boolean: (c) =>
    expect(c.querySelector('input[type="checkbox"]'), 'boolean: expected an input[type="checkbox"]').not.toBeNull(),
  date: (c) => expect(c.querySelector('input[type="date"]'), 'date: expected an input[type="date"]').not.toBeNull(),
  image: (c) =>
    expect(
      c.querySelector('input[type="text"][placeholder="Attachment id"]'),
      'image: expected the attachment-id text input',
    ).not.toBeNull(),
  address: (c) => {
    const group = c.querySelector('[role="group"]');
    expect(group, 'address: expected a role="group" container').not.toBeNull();
    // The part inputs (editors/FieldEditor.tsx's `address` case) carry no `type` attribute
    // at all — unlike every other text-like control here, which sets one explicitly — so
    // this counts plain `<input>`s rather than an `input[type="text"]` attribute selector.
    expect(group?.querySelectorAll('input').length, 'address: expected 5 address part inputs').toBe(5);
  },
};

describe('FieldEditor', () => {
  it('renders the SPECIFIC control each catalog type calls for', () => {
    for (const type of FIELD_TYPES) {
      // multi_select renders one checkbox per configured option — with the empty config
      // `def()` defaults to, that is correctly zero, so CONTROL_CHECK's checkbox-count
      // assertion needs real options here to exercise the same thing "renders one option
      // per configured choice for select" below configures explicitly for `select`.
      const config = type === 'multi_select' ? { options: ['a', 'b'] } : {};
      const { container, unmount } = render(
        <FieldEditor def={def(type, config)} value={undefined} onChange={() => {}} />,
      );
      CONTROL_CHECK[type](container);
      unmount();
    }
  });

  it('emits no `for` that points at something a browser will not focus', () => {
    // R6-M1. `multi_select` and `address` render a `<div role="group">` with no id, while the
    // shared heading was `<label htmlFor={id}>` for every type — so on those two the `for`
    // named an element that did not exist and clicking the label focused nothing.
    //
    // The assertion is the PREDICATE, over the whole catalog, not the two types that were
    // wrong: `for` is honoured only against a labelable element, so an id that merely EXISTS
    // is not enough (giving the group div an `id={id}` would satisfy a
    // `getElementById(...) !== null` check and still focus nothing). A type added to
    // FIELD_TYPES later is covered automatically, because the loop is over the catalog.
    const LABELABLE = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'METER', 'OUTPUT', 'PROGRESS'];
    for (const type of FIELD_TYPES) {
      const config = type === 'multi_select' ? { options: ['a', 'b'] } : {};
      const { container, unmount } = render(
        <FieldEditor def={def(type, config)} value={undefined} onChange={() => {}} />,
      );
      for (const el of container.querySelectorAll('label[for]')) {
        const target = document.getElementById(el.getAttribute('for')!);
        expect(target, `${type}: label[for] names no element`).not.toBeNull();
        expect(LABELABLE, `${type}: label[for] names a <${target!.tagName.toLowerCase()}>`)
          .toContain(target!.tagName);
      }
      unmount();
    }
  });

  it('names the group control for the types that render one, without a label element', () => {
    // The other half: dropping the `for` must not drop the NAME. Both group types are named
    // through `aria-labelledby`, which `getByRole(..., { name })` resolves the same way a
    // screen reader does — so this fails both if the heading disappears and if the
    // `aria-labelledby` stops pointing at it.
    for (const type of ['multi_select', 'address'] as const) {
      const config = type === 'multi_select' ? { options: ['a', 'b'] } : {};
      const { unmount } = render(
        <FieldEditor def={def(type, config)} value={undefined} onChange={() => {}} />,
      );
      expect(screen.getByRole('group', { name: 'A field' }), type).toBeInTheDocument();
      unmount();
    }
  });

  it('reports the typed value, not the raw event target', async () => {
    const onChange = vi.fn();
    render(<FieldEditor def={def('boolean')} value={false} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders one option per configured choice for select', () => {
    render(<FieldEditor def={def('select', { options: ['alpha', 'beta'] })} value="" onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'beta' })).toBeInTheDocument();
  });

  it('toggles a multi_select value in and out of the array', async () => {
    const onChange = vi.fn();
    render(
      <FieldEditor def={def('multi_select', { options: ['a', 'b'] })} value={['a']} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'b' }));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('shows the error it is given and marks the control invalid', () => {
    render(<FieldEditor def={def('text')} value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('ties the private-field note to the control with aria-describedby, not merely renders it', () => {
    // R4 :999. A note that only sits near the control is invisible to a screen reader; the
    // fix is the association, so the assertion has to be the association — not
    // `getByText(...)`, which a visually-adjacent-but-unlinked paragraph would also satisfy.
    render(<FieldEditor def={{ ...def('text'), visibility: 'private' }} value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    for (const id of describedBy!.split(' ')) {
      expect(document.getElementById(id)?.textContent).toMatch(/only the registry owner/i);
    }
  });

  it('space-joins the private note and the error into one aria-describedby, dropping neither', () => {
    render(
      <FieldEditor
        def={{ ...def('text'), visibility: 'private' }}
        value=""
        onChange={() => {}}
        error="Required"
      />,
    );
    const input = screen.getByRole('textbox');
    const ids = input.getAttribute('aria-describedby')!.split(' ');
    const texts = ids.map((id) => document.getElementById(id)?.textContent);
    expect(texts.some((t) => /only the registry owner/i.test(t ?? ''))).toBe(true);
    expect(texts.some((t) => t === 'Required')).toBe(true);
  });

  it('renders no private note and no describedby for a public field', () => {
    render(<FieldEditor def={{ ...def('text'), visibility: 'public' }} value="" onChange={() => {}} />);
    expect(screen.queryByText(/only the registry owner/i)).toBeNull();
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });
});
