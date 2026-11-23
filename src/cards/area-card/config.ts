import { BADGE_KEYS, type AreaCardConfig, type BadgeKey } from "./types";

type HideKey = `hide_${BadgeKey}`;
type EntitiesKey = `${BadgeKey}_entities`;

type LegacyConfig = AreaCardConfig & {
  badges?: Record<string, unknown>;
  temperature_sensor?: string;
  humidity_sensor?: string;
  presence_sensors?: string[];
  door_sensors?: string[];
  window_sensors?: string[];
};

const LEGACY_SENSOR_KEYS: Partial<Record<BadgeKey, string>> = {
  temperature: "temperature_sensor",
  humidity: "humidity_sensor",
  presence: "presence_sensors",
  door: "door_sensors",
  window: "window_sensors",
};

function asList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).filter(
    (id): id is string => typeof id === "string" && id !== ""
  );
}

// Converts configs written by older versions into the current
// `<badge>_entities` / `hide_<badge>` format:
// - <= 0.3.4 used `temperature_sensor`, `presence_sensors`, ... and its
//   editor nested every badge option under a `badges:` key by mistake.
// - 0.3.5 used a `<badge>: area | hide | entities` mode key.
export function migrateConfig(input: AreaCardConfig): AreaCardConfig {
  const legacy: LegacyConfig = {
    ...input,
    ...((input as LegacyConfig).badges ?? {}),
  };
  const config: Record<string, unknown> = { ...legacy };
  delete config.badges;

  for (const key of BADGE_KEYS) {
    const entitiesKey: EntitiesKey = `${key}_entities`;
    const hideKey: HideKey = `hide_${key}`;

    const legacySensorKey = LEGACY_SENSOR_KEYS[key];
    if (legacySensorKey) {
      if (config[entitiesKey] === undefined) {
        const list = asList(config[legacySensorKey]);
        if (list.length > 0) {
          config[entitiesKey] = list;
        }
      }
      delete config[legacySensorKey];
    }

    const mode = config[key];
    if (mode === "hide") {
      config[hideKey] = true;
    } else if (mode === "area") {
      delete config[entitiesKey];
    }
    delete config[key];

    if (!config[hideKey]) {
      delete config[hideKey];
    }
    if (asList(config[entitiesKey]).length === 0) {
      delete config[entitiesKey];
    }
  }
  return config as AreaCardConfig;
}

export function badgeHidden(config: AreaCardConfig, key: BadgeKey): boolean {
  return !!config[`hide_${key}` as HideKey];
}

// Explicitly selected sensors; empty means "use the area default".
export function badgeEntities(config: AreaCardConfig, key: BadgeKey): string[] {
  return config[`${key}_entities` as EntitiesKey] ?? [];
}
