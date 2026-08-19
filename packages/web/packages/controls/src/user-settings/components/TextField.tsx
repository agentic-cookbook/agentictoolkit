'use client'

import { useId, type ReactNode } from 'react'

import { noAutofillProps, noAutofillPropsFor } from '../../internal/autofill'

interface BaseTextFieldProps {
  label?: ReactNode
  hint?: ReactNode
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

export interface TextFieldProps extends BaseTextFieldProps {
  type?: 'text' | 'email' | 'url' | 'tel'
  /**
   * A real autofill token (`email`, `tel`, `url`, `name`, …) when this field holds the
   * READER'S own detail rather than a record's — a settings panel asking for their own
   * contact address is the case this exists for. Naming one hands the field back to the
   * browser and to every password manager; leaving it out (or passing `"off"`) keeps the
   * fleet default, which is to keep all of them out. The prop interface here is closed,
   * so this is the only way a caller can say so.
   */
  autoComplete?: string
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  multiline,
  disabled,
  className,
  id,
  type = 'text',
  autoComplete,
}: TextFieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--text', className].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {label && (
        <label htmlFor={fieldId} className="aws-field__label">
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          id={fieldId}
          className="aws-field__input aws-field__textarea"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          autoComplete={autoComplete}
          {...noAutofillPropsFor(autoComplete)}
        />
      ) : (
        <input
          id={fieldId}
          type={type}
          className="aws-field__input"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          // Written before the spread, so a real token wins: the helper returns an empty
          // bag for one, and the full six attributes for `undefined` or `"off"`.
          autoComplete={autoComplete}
          {...noAutofillPropsFor(autoComplete)}
        />
      )}
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}

export interface SecureTextFieldProps extends BaseTextFieldProps {}

export function SecureTextField(props: SecureTextFieldProps) {
  const { label, hint, value, onChange, placeholder, disabled, className, id } = props
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const cls = ['aws-field', 'aws-field--text', 'aws-field--secure', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls}>
      {label && (
        <label htmlFor={fieldId} className="aws-field__label">
          {label}
        </label>
      )}
      <input
        id={fieldId}
        type="password"
        className="aws-field__input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        // `type="password"` here means "mask it on screen" — this is a settings
        // secret (an API key, a token), never the account credential. Without the
        // opt-out every manager offers to save it as the site's password and then
        // offers it back on the sign-in form.
        {...noAutofillProps}
      />
      {hint && <p className="aws-field__hint">{hint}</p>}
    </div>
  )
}
