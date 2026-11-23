import type { AreaCardConfig, BadgeKey, BadgeMode } from "./types";

type LegacyConfig = AreaCardConfig & {
  badges?: Record<string, unknown>;
  temperature_sensor?: string;
  humidity_sensor?: string;
  hide_humidity?: boolean;
  presence_sensors?: string[];
  door_sensors?: string[];
  hide_door?: boolean;
  window_sensors?: string[];
  hide_window?: boolean;
};

const LEGACY_KEYS = [
  "badges",
  "temperature_sensor",
  "humidity_sensor",
  "hide_humidity",
  "presence_sensors",
  "door_sensors",
  "hide_door",
  "window_sensors",
  "hide_window",
] as const;

function legacyBadge(
  config: AreaCardConfig,
  key: BadgeKey,
  entities: string | string[] | undefined,
  hide: boolean | undefined
): void {
  if (config[key] !== undefined) {
    return;
  }
  if (hide) {
    config[key] = "hide";
    return;
  }
  const list = (Array.isArray(entities) ? entities : [entities]).filter(
    (id): id is string => !!id
  );
  if (list.length > 0) {
    config[key] = "entities";
    config[`${key}_entities` as `${BadgeKey}_entities`] = list;
  }
}

// Converts configs written by older versions into the current per-badge
// mode/entities format. Older editors also nested the badge options under a
// `badges:` key by mistake, so those are flattened first.
export function migrateConfig(input: AreaCardConfig): AreaCardConfig {
  const legacy: LegacyConfig = {
    ...input,
    ...((input as LegacyConfig).badges ?? {}),
  };
  const config: AreaCardConfig = { ...legacy };
  for (const key of LEGACY_KEYS) {
    delete (config as Record<string, unknown>)[key];
  }

  legacyBadge(config, "temperature", legacy.temperature_sensor, false);
  legacyBadge(config, "humidity", legacy.humidity_sensor, legacy.hide_humidity);
  legacyBadge(config, "presence", legacy.presence_sensors, false);
  legacyBadge(config, "door", legacy.door_sensors, legacy.hide_door);
  legacyBadge(config, "window", legacy.window_sensors, legacy.hide_window);
  return config;
}

export function badgeMode(config: AreaCardConfig, key: BadgeKey): BadgeMode {
  return config[key] ?? "area";
}

export function badgeEntities(config: AreaCardConfig, key: BadgeKey): string[] {
  return config[`${key}_entities` as `${BadgeKey}_entities`] ?? [];
}
