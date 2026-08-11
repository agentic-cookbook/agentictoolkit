// The crossing. adh sites import from here, never from @agenticdevelopertoolkit/* — two
// copies of that scope exist on disk in an adh checkout and nothing dedupes across
// directories, so a site that named the scope directly would bundle both.
export { RegistryProfile, FieldValue, ServiceList } from '@agenticdevelopertoolkit/registry-profile';
export type {
  PublicEntry, PublicField, PublicService, RegistryProfileProps, FieldValueProps,
} from '@agenticdevelopertoolkit/registry-profile';
