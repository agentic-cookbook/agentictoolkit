'use client'

export { CrudTable } from './CrudTable'
export { CrudRecordForm } from './CrudRecordForm'
export { CrudTablePage } from './CrudTablePage'
export type { CrudTablePageProps } from './CrudTablePage'
export { CrudDataBrowser, DefaultCrudShell } from './CrudDataBrowser'
export type {
  CrudDataBrowserProps,
  CrudBrowserSelection,
  CrudShell,
  CrudShellProps,
} from './CrudDataBrowser'
export { useExitGuardChannel } from './useExitGuardChannel'
export { CrudDataView } from './CrudDataView'
export type { CrudDataViewProps } from './CrudDataView'
export { CrudFieldInput, isJsonColumn } from './CrudFieldInput'
export type { CrudFieldInputProps } from './CrudFieldInput'
export {
  isColumnEditable,
  isRelationalColumn,
  isColumnHidden,
  EDITABLE_OVERRIDES,
} from './editability'
export type { EditableMode, EditableOverrides } from './editability'
export { canReadTable, canWriteTable, readableTables } from './exposure'
export { CRUD_TABLES } from './generated/table-metadata'
export { CRUD_SCHEMAS } from './schemas'
export { ErrorText } from '@agentic-toolkit/ui/components/error-text'
export { useAction } from '@agentic-toolkit/ui/hooks/useAction'
export type { ActionState } from '@agentic-toolkit/ui/hooks/useAction'
export { rowKey } from './useCrudResource'
export { errorMessage } from '@agentic-toolkit/ui/lib/errors'
export type { CrudColumn, CrudColumnType, CrudExposure, CrudRow, CrudTableMeta } from './types'
