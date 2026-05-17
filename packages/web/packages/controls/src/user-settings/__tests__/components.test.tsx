import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TextField, SecureTextField } from '../components/TextField'
import { Checkbox } from '../components/Checkbox'
import { Slider } from '../components/Slider'
import { Stepper } from '../components/Stepper'
import { RadioGroup } from '../components/RadioGroup'
import { Select } from '../components/Select'
import { ChoiceSlider } from '../components/ChoiceSlider'
import { ColorPicker } from '../components/ColorPicker'
import { SettingsButton } from '../components/SettingsButton'
import { Progress } from '../components/Progress'
import { Conditional } from '../components/Conditional'
import { DismissibleHint } from '../components/DismissibleHint'
import { useSetting } from '../hooks/useSetting'

function resetStorage() {
  const ls = window.localStorage
  if (!ls) return
  for (let i = ls.length - 1; i >= 0; i--) {
    const k = ls.key(i)
    if (k) ls.removeItem(k)
  }
}

describe('TextField', () => {
  it('fires onChange with new value', () => {
    const onChange = vi.fn()
    render(<TextField label="Name" value="Alice" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bob' } })
    expect(onChange).toHaveBeenCalledWith('Bob')
  })

  it('renders multiline as textarea', () => {
    const { container } = render(
      <TextField label="Bio" value="" onChange={() => {}} multiline />,
    )
    expect(container.querySelector('textarea')).toBeInTheDocument()
  })
})

describe('SecureTextField', () => {
  it('renders password input', () => {
    const { container } = render(
      <SecureTextField label="Token" value="" onChange={() => {}} />,
    )
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument()
  })
})

describe('Checkbox', () => {
  it('toggles via onChange', () => {
    const onChange = vi.fn()
    render(<Checkbox label="On" value={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('renders as plain checkbox when appearance="check"', () => {
    render(<Checkbox label="On" value={false} onChange={() => {}} appearance="check" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })
})

describe('Slider', () => {
  it('emits numeric value', () => {
    const onChange = vi.fn()
    render(<Slider label="Vol" value={5} onChange={onChange} min={0} max={10} />)
    fireEvent.change(screen.getByLabelText('Vol'), { target: { value: '8' } })
    expect(onChange).toHaveBeenCalledWith(8)
  })

  it('renders dynamic caption', () => {
    render(
      <Slider label="Vol" value={5} onChange={() => {}} caption={(v) => `${v}px`} />,
    )
    expect(screen.getByText('5px')).toBeInTheDocument()
  })
})

describe('Stepper', () => {
  it('increments and decrements within bounds', () => {
    const onChange = vi.fn()
    render(<Stepper label="N" value={5} onChange={onChange} min={0} max={10} />)
    fireEvent.click(screen.getByRole('button', { name: 'Increment' }))
    expect(onChange).toHaveBeenCalledWith(6)
    fireEvent.click(screen.getByRole('button', { name: 'Decrement' }))
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('disables decrement at min', () => {
    render(<Stepper label="N" value={0} onChange={() => {}} min={0} max={10} />)
    expect(screen.getByRole('button', { name: 'Decrement' })).toBeDisabled()
  })
})

describe('RadioGroup', () => {
  it('selects a choice', () => {
    const onChange = vi.fn()
    render(
      <RadioGroup
        label="Pick"
        value="a"
        onChange={onChange}
        choices={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    )
    fireEvent.click(screen.getByLabelText('B'))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('Select', () => {
  it('emits selected value', () => {
    const onChange = vi.fn()
    render(
      <Select
        label="Theme"
        value="a"
        onChange={onChange}
        choices={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    )
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('ChoiceSlider', () => {
  it('snaps to discrete choices', () => {
    const onChange = vi.fn()
    render(
      <ChoiceSlider
        label="Q"
        value="med"
        onChange={onChange}
        choices={[
          { value: 'low', label: 'Low' },
          { value: 'med', label: 'Medium' },
          { value: 'high', label: 'High' },
        ]}
      />,
    )
    fireEvent.change(screen.getByLabelText('Q'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith('high')
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })
})

describe('ColorPicker', () => {
  it('emits new color', () => {
    const onChange = vi.fn()
    render(<ColorPicker label="C" value="#ff0000" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('C'), { target: { value: '#00ff00' } })
    expect(onChange).toHaveBeenCalledWith('#00ff00')
  })
})

describe('SettingsButton', () => {
  it('applies variant class', () => {
    const { container } = render(
      <SettingsButton variant="destructive">Delete</SettingsButton>,
    )
    expect(container.querySelector('.aws-button--destructive')).toBeInTheDocument()
  })
})

describe('Progress', () => {
  it('reports aria-valuenow', () => {
    render(<Progress label="Up" value={42} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })

  it('omits aria-valuenow when indeterminate', () => {
    render(<Progress label="Up" indeterminate />)
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })
})

describe('Conditional', () => {
  it('renders children when truthy', () => {
    render(<Conditional when={true}><span>shown</span></Conditional>)
    expect(screen.getByText('shown')).toBeInTheDocument()
  })

  it('renders fallback when falsy', () => {
    render(<Conditional when={false} fallback={<span>fallback</span>}><span>shown</span></Conditional>)
    expect(screen.getByText('fallback')).toBeInTheDocument()
    expect(screen.queryByText('shown')).not.toBeInTheDocument()
  })
})

describe('DismissibleHint', () => {
  beforeEach(() => resetStorage())

  it('hides itself when dismissed and persists', () => {
    const { unmount } = render(<DismissibleHint id="abc">tip</DismissibleHint>)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('tip')).not.toBeInTheDocument()
    unmount()
    render(<DismissibleHint id="abc">tip</DismissibleHint>)
    expect(screen.queryByText('tip')).not.toBeInTheDocument()
  })
})

describe('useSetting', () => {
  beforeEach(() => resetStorage())

  it('reads default and persists writes', () => {
    function Host() {
      const [v, setV] = useSetting<number>('demo:n', 5)
      return (
        <button onClick={() => setV(v + 1)}>{v}</button>
      )
    }
    render(<Host />)
    expect(screen.getByText('5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(window.localStorage.getItem('demo:n')).toBe('6')
  })

  it('reset() clears storage and restores default', () => {
    function Host() {
      const [v, setV, reset] = useSetting<number>('demo:r', 1)
      return (
        <>
          <span>val={v}</span>
          <button onClick={() => setV(99)}>set</button>
          <button onClick={reset}>reset</button>
        </>
      )
    }
    render(<Host />)
    fireEvent.click(screen.getByText('set'))
    expect(screen.getByText('val=99')).toBeInTheDocument()
    fireEvent.click(screen.getByText('reset'))
    expect(screen.getByText('val=1')).toBeInTheDocument()
    expect(window.localStorage.getItem('demo:r')).toBe(null)
  })

  it('honors a custom storage object', () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    function Host() {
      const [v, setV] = useSetting<string>('k', 'a', { storage })
      return <button onClick={() => setV('b')}>{v}</button>
    }
    render(<Host />)
    fireEvent.click(screen.getByRole('button'))
    expect(store.get('k')).toBe('"b"')
  })

  it('syncs across tabs via the storage event', () => {
    function Host() {
      const [v] = useSetting<number>('demo:s', 0)
      return <span>val={v}</span>
    }
    render(<Host />)
    expect(screen.getByText('val=0')).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'demo:s',
          newValue: '7',
        }),
      )
    })
    expect(screen.getByText('val=7')).toBeInTheDocument()
  })
})
