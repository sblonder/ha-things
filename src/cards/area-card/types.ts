import type { HomeAssistant, LovelaceCardConfig } from "custom-card-helpers";

export interface AreaCardConfig extends LovelaceCardConfig {
  area?: string;
  name?: string;
  icon?: string;
  devices?: string[];
  background?: boolean;
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

// Bottom device-button slots. All configured devices up to this count are
// always rendered; styles.ts hides the 3rd/4th via a container query at
// narrow (3-wide) widths, so no JS-side layout detection is needed.
export const MAX_DEVICES = 4;
