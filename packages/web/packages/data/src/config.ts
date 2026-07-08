// Host-injectable runtime config for @agentic-toolkit/data — mirrors the sibling
// auth package's configureAuth/authConfig pattern. Today it owns only the
// localStorage key prefix the FTD UI-persistence uses, so a non-adh host can
// namespace its stored view state instead of colliding under the adh brand.

export interface DataRuntimeConfig {
  /** Prefix for this package's FTD localStorage keys (`<prefix>:ftd:<basePath>:<name>`).
   *  Defaults to "adh" so the adh hosts' stored keys are unchanged. */
  storageKeyPrefix: string;
}

let config: DataRuntimeConfig = {
  storageKeyPrefix: "adh",
};

/** Override the data-package runtime config (call once at host bootstrap). */
export function configureData(partial: Partial<DataRuntimeConfig>): void {
  config = { ...config, ...partial };
}

export function dataConfig(): DataRuntimeConfig {
  return config;
}
