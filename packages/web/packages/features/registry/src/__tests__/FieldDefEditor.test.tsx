import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldDefEditor } from '../editors/FieldDefEditor';
import type { FieldDefDraft, FieldDefEditorProps } from '../editors/FieldDefEditor';

const draft = (patch: Partial<FieldDefDraft> = {}): FieldDefDraft => ({
  key: 'k', type: 'text', label: 'L', help: '', required: false,
  visibility: 'public', config: {}, sortOrder: 0, showIf: null, ...patch,
});

afterEach(cleanup);

describe('FieldDefEditor', () => {
  it('freezes key and type once the field has been saved', () => {
    render(<FieldDefEditor def={draft({ id: 'f1' })} onChange={vi.fn()} />);
    // Every existing entry stores its answer under this key and in this type's shape. A
    // rename orphans them all; a retype has no correct answer for the ones that will not
    // coerce, and the server 400s the attempt anyway.
    expect(screen.getByLabelText('Key').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Type').hasAttribute('disabled')).toBe(true);
  });

  it('leaves both editable while the field is new', () => {
    render(<FieldDefEditor def={draft()} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Key').hasAttribute('disabled')).toBe(false);
  });

  it('collects select options one per line, dropping the blanks', async () => {
    const onChange = vi.fn();
    render(<FieldDefEditor def={draft({ type: 'select' })} onChange={onChange} />);
    // A single paste fires one input event carrying the whole string. `userEvent.type` cannot
    // produce this: the textarea's value is a controlled `rawOptions.join('\n')`, so against a
    // bare `vi.fn()` onChange it snaps back to '' after every keystroke, and even with real
    // state the blank-line filter means a bare Enter can never survive the round trip.
    const box = screen.getByLabelText('Options (one per line)');
    box.focus();
    await userEvent.paste('a\n\nb');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ config: { options: ['a', 'b'] } }),
    );
  });
});

describe('FieldDefEditor ordering', () => {
  it('offers move up and move down', () => {
    render(
      <FieldDefEditor
        def={draft()}
        onChange={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp
        canMoveDown
      />,
    );
    expect(screen.getByRole('button', { name: /Move up/ })).not.toBeNull();
    expect(screen.getByRole('button', { name: /Move down/ })).not.toBeNull();
  });

  it('disables the end of the run rather than hiding it', () => {
    render(
      <FieldDefEditor
        def={draft()}
        onChange={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        canMoveUp={false}
        canMoveDown
      />,
    );
    // A control that vanishes at the boundary makes the row's layout jump and reads as a
    // missing feature; the pair disables on purpose instead.
    expect(
      screen.getByRole('button', { name: /Move up/ }).hasAttribute('disabled'),
    ).toBe(true);
  });
});

describe('FieldDefEditor show_if', () => {
  // The component is fully controlled, so a case that inspects rendered markup AFTER an
  // interaction needs the `def` prop to actually change between renders — a bare `vi.fn()`
  // onChange never re-renders the tree with the new rule. This harness feeds `onChange`'s
  // output back in as the next `def`, the way the real builder does. Cases that only assert
  // on the onChange payload ("writes the rule as data", "removes the rule entirely") stay on
  // a plain mock, where a single call is the whole point.
  function Controlled({ onChange, ...props }: FieldDefEditorProps) {
    const [def, setDef] = useState(props.def);
    return (
      <FieldDefEditor
        {...props}
        def={def}
        onChange={(next) => {
          setDef(next);
          onChange(next);
        }}
      />
    );
  }

  it('shows no rule controls until the owner asks for one', () => {
    render(<FieldDefEditor def={draft()} onChange={vi.fn()} siblings={[]} />);
    expect(screen.queryByLabelText('Only show this when')).toBeNull();
  });

  it('offers only the OTHER fields as the rule’s subject', async () => {
    render(
      <Controlled
        def={draft({ key: 'me' })}
        onChange={vi.fn()}
        siblings={[
          { key: 'me', label: 'Me', type: 'text' },
          { key: 'kind', label: 'Kind of work', type: 'text' },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add a condition' }));
    const options = Array.from(
      screen.getByLabelText<HTMLSelectElement>('Only show this when').options,
    ).map((o) => o.value);
    // A field conditioned on itself is unreachable: it is hidden, so its value stays unset,
    // so it stays hidden.
    expect(options).toEqual(['kind']);
  });

  it('writes the rule as data', async () => {
    const onChange = vi.fn();
    render(
      <FieldDefEditor
        def={draft({ key: 'me' })}
        onChange={onChange}
        siblings={[{ key: 'kind', label: 'Kind of work', type: 'text' }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add a condition' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showIf: { field: 'kind', op: 'eq', value: '' } }),
    );
  });

  it('drops the value box for an op that takes no value', async () => {
    render(
      <Controlled
        def={draft({ showIf: { field: 'kind', op: 'eq', value: 'x' } })}
        onChange={vi.fn()}
        siblings={[{ key: 'kind', label: 'Kind of work', type: 'text' }]}
      />,
    );
    expect(screen.getByLabelText('is')).not.toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Test'), 'truthy');
    expect(screen.queryByLabelText('is')).toBeNull();
  });

  it('removes the rule entirely', async () => {
    const onChange = vi.fn();
    render(
      <FieldDefEditor
        def={draft({ showIf: { field: 'kind', op: 'eq', value: 'x' } })}
        onChange={onChange}
        siblings={[{ key: 'kind', label: 'Kind of work', type: 'text' }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Always show this' }));
    // `null`, not `undefined`: the column is nullable and the write schema defaults to null,
    // so `undefined` would leave the old rule in place.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showIf: null }));
  });

  // F1 (review fix round 1): the value control used to be one bare text `<input>` regardless
  // of what op or subject type it fed. `in` needs an array (evaluateShowIf fails OPEN — shows
  // the field — when a rule's value is not an array), and a boolean subject's `eq`/`ne` needs
  // a real boolean, not the string "true".
  it('parses an `in` rule’s value into an array before it reaches onChange', async () => {
    const onChange = vi.fn();
    render(
      <FieldDefEditor
        def={draft({ showIf: { field: 'kind', op: 'in', value: [] } })}
        onChange={onChange}
        siblings={[{ key: 'kind', label: 'Kind of work', type: 'text' }]}
      />,
    );
    const box = screen.getByLabelText('is one of');
    box.focus();
    await userEvent.paste('ios, android');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        showIf: expect.objectContaining({ value: ['ios', 'android'] }),
      }),
    );
  });

  it('stores a real boolean for a boolean subject’s `eq` rule', async () => {
    const onChange = vi.fn();
    render(
      <FieldDefEditor
        def={draft({ showIf: { field: 'flag', op: 'eq', value: '' } })}
        onChange={onChange}
        siblings={[{ key: 'flag', label: 'Flag', type: 'boolean' }]}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('is'), 'true');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showIf: expect.objectContaining({ value: true }) }),
    );
  });

  // R6-I2: "Add a condition" on a boolean-only sibling list used to author
  // `{op:'eq', value:''}` — a rule no boolean answer can ever equal, so the field it guards
  // was hidden for every registrant forever with nothing on screen saying why. Fixed by
  // having `coerceRuleValue` start a boolean subject's `eq`/`ne` on a real boolean instead of
  // an empty string, which makes that unsatisfiable state unrepresentable. This is the "Add a
  // condition" click itself — distinct from "stores a real boolean for a boolean subject's
  // `eq` rule" above, which only covers picking a value in the already-present dropdown.
  it('starts a boolean sibling’s condition on a real boolean, not an empty string', async () => {
    const onChange = vi.fn();
    render(
      <FieldDefEditor
        def={draft({ key: 'me' })}
        onChange={onChange}
        siblings={[{ key: 'flag', label: 'Flag', type: 'boolean' }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add a condition' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ showIf: { field: 'flag', op: 'eq', value: true } }),
    );
  });

  it('omits `eq` from the operator list for a multi_select subject', () => {
    render(
      <FieldDefEditor
        def={draft({ showIf: { field: 'tags', op: 'contains', value: '' } })}
        onChange={vi.fn()}
        siblings={[{ key: 'tags', label: 'Tags', type: 'multi_select' }]}
      />,
    );
    const ops = Array.from(screen.getByLabelText<HTMLSelectElement>('Test').options).map(
      (o) => o.value,
    );
    expect(ops).not.toContain('eq');
    expect(ops).toEqual(['contains', 'truthy', 'falsy']);
  });

  // F2 (review fix round 1): a rule can outlive the field it names — the subject field gets
  // deleted while another field's rule still points at its key. `evaluateShowIf` fails open
  // for a subject it cannot resolve to a value at all (undefined reads as falsy for every op
  // but `falsy` itself), so a dangling rule silently keeps hiding its field for every
  // registrant rather than erroring. The editor must say so, not render a blank-seeming select.
  it('surfaces a rule that points at a field that no longer exists', () => {
    render(
      <FieldDefEditor
        def={draft({ showIf: { field: 'ghost', op: 'eq', value: 'x' } })}
        onChange={vi.fn()}
        siblings={[{ key: 'kind', label: 'Kind of work', type: 'text' }]}
      />,
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Only show this when').value).toBe('ghost');
    expect(screen.getByRole('alert')).toHaveTextContent('ghost');
  });
});
