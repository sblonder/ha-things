import type { ActionConfig, LovelaceCardConfig } from "custom-card-helpers";

export interface TileCardConfigBase extends LovelaceCardConfig {
  entity?: string;
  name?: string;
  hide_state?: boolean;
  state_content?: string | string[];
  icon?: string;
  color?: string;
  show_entity_picture?: boolean;
  vertical?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  icon_tap_action?: ActionConfig;
  icon_hold_action?: ActionConfig;
  icon_double_tap_action?: ActionConfig;
  features?: unknown[];
  features_position?: "bottom" | "inline";
  time_format?: string;
}

export interface ClimateDefaultsTileCardConfig extends TileCardConfigBase {
  target_hvac_mode?: string;
  target_temperature?: number;
  target_fan_mode?: string;
}

export const CUSTOM_CONFIG_KEYS = [
  "target_hvac_mode",
  "target_temperature",
  "target_fan_mode",
] as const;

export type CustomConfigKey = (typeof CUSTOM_CONFIG_KEYS)[number];

export const CARD_TAG = "climate-defaults-tile-card";
export const EDITOR_TAG = "climate-defaults-tile-card-editor";
export const BASE_CARD_TAG = "hui-tile-card";
export const BASE_EDITOR_TAG = "hui-tile-card-editor";
