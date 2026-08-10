import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

export interface AreaCardConfig extends LovelaceCardConfig {
  area?: string;
  name?: string;
  icon?: string;
  devices?: string[];
  background?: boolean;

  temperature_sensor?: string;
  humidity_sensor?: string;
  hide_humidity?: boolean;

  presence_sensors?: string[];

  door_sensors?: string[];
  hide_door?: boolean;

  window_sensors?: string[];
  hide_window?: boolean;
}

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
  area_id: string | null;
  device_id: string | null;
  labels: string[];
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

export const PRESENCE_DEVICE_CLASSES = [
  "motion",
  "occupancy",
  "presence",
] as const;

export const CARD_TAG = "area-card";
export const EDITOR_TAG = "area-card-editor";
export const DIALOG_TAG = "area-card-problem-dialog";

// Bottom device-button slots. AreaCard's ResizeObserver picks 2 or 4 based on
// the card's own measured aspect ratio (see _updateCompact).
export const MAX_DEVICES = 4;
export const COMPACT_DEVICES = 2;

// Long-press threshold (ms) that distinguishes a toggle tap from a
// more-info hold on device buttons.
export const HOLD_MS = 500;
