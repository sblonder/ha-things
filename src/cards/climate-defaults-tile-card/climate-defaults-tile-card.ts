import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { ensureEditorRegistered } from "./climate-defaults-tile-card-editor";
import {
  BASE_CARD_TAG,
  CARD_TAG,
  EDITOR_TAG,
  type ClimateDefaultsTileCardConfig,
} from "./types";

interface ClimateDefaults {
  hvacMode?: string;
  temperature?: number;
  fanMode?: string;
}

type IconAction = "tap" | "hold" | "double_tap";

interface HuiTileCardInstance extends HTMLElement {
  hass?: HomeAssistant;
  _config?: ClimateDefaultsTileCardConfig;
  setConfig(config: ClimateDefaultsTileCardConfig): void;
  _handleIconAction(ev: CustomEvent): void | Promise<void>;
}

interface HuiTileCardConstructor {
  new (): HuiTileCardInstance;
  getConfigElement(): Promise<LovelaceCardEditor>;
}

function getBaseTileCardClass(): HuiTileCardConstructor {
  const base = customElements.get(BASE_CARD_TAG);
  if (!base) {
    throw new Error(
      `[${CARD_TAG}] Required built-in element "<${BASE_CARD_TAG}>" is not registered. ` +
        "This card must be loaded inside a running Home Assistant frontend, after core " +
        "elements have been defined."
    );
  }
  return base as unknown as HuiTileCardConstructor;
}

function defineCard(): void {
  const BaseTileCard = getBaseTileCardClass();

  class ClimateDefaultsTileCard extends BaseTileCard {
    private _climateDefaults: ClimateDefaults = {};

    setConfig(config: ClimateDefaultsTileCardConfig): void {
      const domain = config?.entity?.split(".")[0];
      let effectiveConfig: ClimateDefaultsTileCardConfig = config;

      // climate isn't in HA's DOMAINS_TOGGLE, so the stock card would default the icon's
      // tap action to "none" for climate entities. Inject "toggle" ourselves (unless the
      // user already set one) so the turn-on/defaults flow works without extra YAML.
      if (domain === "climate" && config?.icon_tap_action === undefined) {
        effectiveConfig = { ...config, icon_tap_action: { action: "toggle" } };
      }

      super.setConfig(effectiveConfig);

      this._climateDefaults = {
        hvacMode: config.default_hvac_mode,
        temperature: config.default_temperature,
        fanMode: config.default_fan_mode,
      };
    }

    private _resolvedIconAction(action: IconAction): { action?: string } | undefined {
      const key =
        action === "tap"
          ? "icon_tap_action"
          : action === "hold"
            ? "icon_hold_action"
            : "icon_double_tap_action";
      return (this._config as Record<string, { action?: string } | undefined>)?.[
        key
      ];
    }

    async _handleIconAction(ev: CustomEvent): Promise<void> {
      const entityId = this._config?.entity;
      const stateObj = entityId ? this.hass?.states[entityId] : undefined;
      const domain = entityId?.split(".")[0];
      const actionName = ev?.detail?.action as IconAction | undefined;
      const wasOff = stateObj?.state === "off";
      const actionCfg = actionName
        ? this._resolvedIconAction(actionName)
        : undefined;
      const willToggleOn =
        domain === "climate" && wasOff && actionCfg?.action === "toggle";

      // Unmodified stock behavior: turns the entity on (climate.turn_on) with whatever
      // mode/temperature/fan the integration defaults to. Note this call is
      // fire-and-forget in the stock implementation (it doesn't return/await the
      // underlying service call), so awaiting it here does NOT mean the device has
      // actually finished turning on.
      await super._handleIconAction(ev);

      if (willToggleOn && entityId) {
        // Some integrations (especially IR/cloud-controlled ACs) take real time to
        // process turn_on before they'll accept further changes. Wait for the state
        // to actually leave "off" (bounded, so we don't hang forever if it never
        // does) before sending our defaults, instead of racing them against turn_on.
        await this._waitUntilNotOff(entityId);
        await this._applyClimateDefaults(entityId);
      }
    }

    private async _waitUntilNotOff(
      entityId: string,
      timeoutMs = 4000,
      pollMs = 150
    ): Promise<void> {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (this.hass?.states[entityId]?.state !== "off") {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    }

    private async _applyClimateDefaults(entityId: string): Promise<void> {
      const { hvacMode, temperature, fanMode } = this._climateDefaults;
      if (
        hvacMode === undefined &&
        temperature === undefined &&
        fanMode === undefined
      ) {
        return;
      }
      if (!this.hass) {
        return;
      }

      try {
        if (hvacMode !== undefined && temperature !== undefined) {
          // climate.set_temperature accepts an optional hvac_mode, so a single call
          // covers both instead of two separate service round-trips.
          await this.hass.callService("climate", "set_temperature", {
            entity_id: entityId,
            hvac_mode: hvacMode,
            temperature,
          });
        } else {
          if (hvacMode !== undefined) {
            await this.hass.callService("climate", "set_hvac_mode", {
              entity_id: entityId,
              hvac_mode: hvacMode,
            });
          }
          if (temperature !== undefined) {
            await this.hass.callService("climate", "set_temperature", {
              entity_id: entityId,
              temperature,
            });
          }
        }
        if (fanMode !== undefined) {
          await this.hass.callService("climate", "set_fan_mode", {
            entity_id: entityId,
            fan_mode: fanMode,
          });
        }
      } catch (err) {
        console.warn(
          `[${CARD_TAG}] Failed applying climate defaults for ${entityId}`,
          err
        );
      }
    }

    static async getConfigElement(): Promise<LovelaceCardEditor> {
      // Calling the inherited static method triggers hui-tile-card's own dynamic
      // import() of its editor module. That import is relative to hui-tile-card's own
      // module inside HA's bundle graph (not ours), so it resolves correctly even
      // though we never copied that code, and it's what registers <hui-tile-card-editor>.
      await super.getConfigElement();
      await ensureEditorRegistered();
      return document.createElement(
        EDITOR_TAG
      ) as unknown as LovelaceCardEditor;
    }
  }

  customElements.define(CARD_TAG, ClimateDefaultsTileCard);
}

if (!customElements.get(CARD_TAG)) {
  defineCard();
}

declare global {
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Climate Defaults Tile Card",
  description:
    "Tile card for climate entities that applies your configured default mode/temperature/fan the moment the entity is turned on.",
  preview: true,
});
