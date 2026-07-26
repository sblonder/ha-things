import type { HassEntity } from "home-assistant-js-websocket";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { forwardHaptic } from "custom-card-helpers";
import { ensureEditorRegistered } from "./climate-defaults-tile-card-editor";
import {
  BASE_CARD_TAG,
  CARD_TAG,
  EDITOR_TAG,
  type ClimateDefaultsTileCardConfig,
} from "./types";

interface ClimateTargets {
  hvacMode?: string;
  temperature?: number;
  fanMode?: string;
}

// Used when the user hasn't configured a target HVAC mode: we still need some mode
// to command the device into directly (see _handleIconAction), so we pick the first
// of these the entity actually supports rather than falling through to turn_on's
// undefined last-used mode.
const FALLBACK_HVAC_MODES = ["heat_cool", "cool"] as const;

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
    private _climateTargets: ClimateTargets = {};

    setConfig(config: ClimateDefaultsTileCardConfig): void {
      const domain = config?.entity?.split(".")[0];
      let effectiveConfig: ClimateDefaultsTileCardConfig = config;

      // climate isn't in HA's DOMAINS_TOGGLE, so the stock card would default the icon's
      // tap action to "none" for climate entities. Inject "toggle" ourselves (unless the
      // user already set one) so the turn-on/target flow works without extra YAML.
      if (domain === "climate" && config?.icon_tap_action === undefined) {
        effectiveConfig = { ...config, icon_tap_action: { action: "toggle" } };
      }

      super.setConfig(effectiveConfig);

      this._climateTargets = {
        hvacMode: config.target_hvac_mode,
        temperature: config.target_temperature,
        fanMode: config.target_fan_mode,
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

      if (willToggleOn && entityId && this.hass) {
        const targetHvacMode = this._resolveTargetHvacMode(stateObj);
        if (targetHvacMode !== undefined) {
          // Command the device straight to its target state ourselves instead of
          // going through the stock toggle. climate.turn_on resumes whatever hvac
          // mode the device last used (e.g. heat), and briefly applying that
          // before switching to our target (e.g. cool) is a real, harmful
          // transition on some integrations. Skipping turn_on avoids it entirely.
          // We bypass super._handleIconAction() to do this, so fire the same tap
          // haptic it would have given the user for feedback.
          forwardHaptic("light");
          await this._commandClimateTarget(entityId, targetHvacMode);
          return;
        }
        // No configured target hvac mode, and the entity doesn't support either
        // fallback mode -- there's no safe mode to command directly, so fall
        // through to the stock toggle below and still apply the configured
        // temperature/fan_mode afterward.
      }

      // Unmodified stock behavior: turns the entity on/off with whatever mode the
      // integration defaults to. Note this call is fire-and-forget in the stock
      // implementation (it doesn't return/await the underlying service call), so
      // awaiting it here does NOT mean the device has actually finished turning on.
      await super._handleIconAction(ev);

      if (willToggleOn && entityId) {
        // Some integrations (especially IR/cloud-controlled ACs) take real time to
        // process turn_on before they'll accept further changes. Wait for the state
        // to actually leave "off" (bounded, so we don't hang forever if it never
        // does) before sending temperature/fan_mode, instead of racing them
        // against turn_on.
        await this._waitUntilNotOff(entityId);
        await this._applyClimateTemperatureAndFan(entityId);
      }
    }

    private _resolveTargetHvacMode(
      stateObj: HassEntity | undefined
    ): string | undefined {
      if (this._climateTargets.hvacMode !== undefined) {
        return this._climateTargets.hvacMode;
      }
      const supported: string[] = stateObj?.attributes.hvac_modes ?? [];
      return FALLBACK_HVAC_MODES.find((mode) => supported.includes(mode));
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

    // Drives the device to its exact target state via dedicated service calls
    // (rather than turn_on) in the order the user actually cares about: hvac mode
    // first (that's what "turns it on" correctly), then temperature, then fan mode.
    private async _commandClimateTarget(
      entityId: string,
      hvacMode: string
    ): Promise<void> {
      if (!this.hass) {
        return;
      }
      const { temperature, fanMode } = this._climateTargets;

      try {
        await this.hass.callService("climate", "set_hvac_mode", {
          entity_id: entityId,
          hvac_mode: hvacMode,
        });
        if (temperature !== undefined) {
          await this.hass.callService("climate", "set_temperature", {
            entity_id: entityId,
            temperature,
          });
        }
        if (fanMode !== undefined) {
          await this.hass.callService("climate", "set_fan_mode", {
            entity_id: entityId,
            fan_mode: fanMode,
          });
        }
      } catch (err) {
        console.warn(
          `[${CARD_TAG}] Failed commanding climate target for ${entityId}`,
          err
        );
      }
    }

    // Fallback path used only when no target hvac mode could be resolved (see
    // _resolveTargetHvacMode): the stock toggle already turned the entity on by
    // the time this runs, so just layer temperature/fan_mode on top if configured.
    private async _applyClimateTemperatureAndFan(entityId: string): Promise<void> {
      const { temperature, fanMode } = this._climateTargets;
      if (temperature === undefined && fanMode === undefined) {
        return;
      }
      if (!this.hass) {
        return;
      }

      try {
        if (temperature !== undefined) {
          await this.hass.callService("climate", "set_temperature", {
            entity_id: entityId,
            temperature,
          });
        }
        if (fanMode !== undefined) {
          await this.hass.callService("climate", "set_fan_mode", {
            entity_id: entityId,
            fan_mode: fanMode,
          });
        }
      } catch (err) {
        console.warn(
          `[${CARD_TAG}] Failed applying temperature/fan mode for ${entityId}`,
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
