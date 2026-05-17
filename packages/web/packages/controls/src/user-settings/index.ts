// Container
export { SettingsPanel, type SettingsPanelProps } from './components/SettingsPanel'

// Layout primitives
export { Group, type GroupProps } from './components/Group'
export { Header, type HeaderProps } from './components/Header'
export { VStack, HStack } from './components/Stack'
export { Divider, type DividerProps } from './components/Divider'
export { Explanation, type ExplanationProps } from './components/Explanation'

// Input controls
export { TextField, SecureTextField, type TextFieldProps, type SecureTextFieldProps } from './components/TextField'
export { Checkbox, type CheckboxProps } from './components/Checkbox'
export { Slider, CaptionedSlider, type SliderProps } from './components/Slider'
export { Stepper, type StepperProps } from './components/Stepper'
export { RadioGroup, type RadioGroupProps } from './components/RadioGroup'
export { Select, type SelectProps } from './components/Select'
export { ChoiceSlider, type ChoiceSliderProps } from './components/ChoiceSlider'
export { ColorPicker, type ColorPickerProps } from './components/ColorPicker'
export { SettingsButton, type SettingsButtonProps } from './components/SettingsButton'
export { Progress, type ProgressProps } from './components/Progress'
export { Conditional, type ConditionalProps } from './components/Conditional'
export { DismissibleHint, type DismissibleHintProps } from './components/DismissibleHint'

// Hooks
export { useSetting, type SettingStorage, type UseSettingOptions } from './hooks/useSetting'

// Types
export type {
  Choice,
  SettingsPaneDescriptor,
  SettingsPaneEntry,
  SettingsButtonVariant,
} from './types'
