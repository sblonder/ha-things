import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

export interface AreaCardConfig extends LovelaceCardConfig {
  area?: string;
  name?: string;
  icon?: string;
  hide_icon?: boolean;
  devices?: string[];
  // Per-device icon overrides, keyed by entity id.
  device_icons?: Record<string, string>;
  background?: boolean;
  background_icon_size?: number;

  // Each badge uses its `<badge>_entities` when set, otherwise the area
  // default; `hide_<badge>` turns it off entirely.
  temperature_entities?: string[];
  hide_temperature?: boolean;
  humidity_entities?: string[];
  hide_humidity?: boolean;
  presence_entities?: string[];
  hide_presence?: boolean;
  motion_entities?: string[];
  hide_motion?: boolean;
  door_entities?: string[];
  hide_door?: boolean;
  window_entities?: string[];
  hide_window?: boolean;
}

export const BADGE_KEYS = [
  "temperature",
  "humidity",
  "presence",
  "motion",
  "door",
  "window",
] as const;

export type BadgeKey = (typeof BADGE_KEYS)[number];

export const BADGE_LABELS: Record<BadgeKey, string> = {
  temperature: "Temperature",
  humidity: "Humidity",
  presence: "Presence",
  motion: "Motion",
  door: "Door",
  window: "Window",
};

export const NUMERIC_BADGES = ["temperature", "humidity"] as const;
export type NumericBadgeKey = (typeof NUMERIC_BADGES)[number];

export const BINARY_BADGES = ["presence", "motion", "door", "window"] as const;
export type BinaryBadgeKey = (typeof BINARY_BADGES)[number];

// Device classes used to find an area's sensors for "area" mode.
export const BADGE_DEVICE_CLASSES: Record<BadgeKey, readonly string[]> = {
  temperature: ["temperature"],
  humidity: ["humidity"],
  presence: ["occupancy", "presence"],
  motion: ["motion"],
  door: ["door", "garage_door"],
  window: ["window"],
};

export const BINARY_BADGE_ICONS: Record<BinaryBadgeKey, string> = {
  presence: "mdi:home-account",
  motion: "mdi:motion-sensor",
  door: "mdi:door-open",
  window: "mdi:window-open",
};

// custom-card-helpers' HomeAssistant type predates the area/entity/device
// registries; the real runtime object always has them, so we type just the
// fields this card reads.
export interface AreaRegistryEntry {
  area_id: string;
  name: string;
  icon: string | null;
  temperature_entity_id: string | null;
  humidity_entity_id: string | null;
}

export interface EntityRegistryEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
  labels: string[];
  hidden?: boolean;
  entity_category?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id: string | null;
}

export interface AreaHomeAssistant extends HomeAssistant {
  areas: Record<string, AreaRegistryEntry>;
  entities: Record<string, EntityRegistryEntry>;
  devices: Record<string, DeviceRegistryEntry>;
}

export const CARD_TAG = "area-card";
export const EDITOR_TAG = "area-card-editor";
export const DIALOG_TAG = "area-card-problem-dialog";

// Long-press threshold (ms) that distinguishes a toggle tap from a
// more-info hold on device buttons.
export const HOLD_MS = 500;

// Default side length (px) of the decorative background icon.
export const DEFAULT_BACKGROUND_ICON_SIZE = 80;
