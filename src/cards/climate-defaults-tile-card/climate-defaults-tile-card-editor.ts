import { css, html } from "lit";
import { state } from "lit/decorators.js";
import { mdiTuneVariant } from "@mdi/js";
import type { HomeAssistant } from "custom-card-helpers";
import {
  BASE_EDITOR_TAG,
  EDITOR_TAG,
  type ClimateDefaultsTileCardConfig,
} from "./types";

interface CustomFieldValues {
  target_hvac_mode?: string;
  target_temperature?: number;
  target_fan_mode?: string;
}

const CUSTOM_FIELD_LABELS: Record<string, string> = {
  target_hvac_mode: "Target HVAC mode",
  target_temperature: "Target temperature",
  target_fan_mode: "Target fan mode",
};

interface HuiTileCardEditorInstance extends HTMLElement {
  hass?: HomeAssistant;
  _config?: ClimateDefaultsTileCardConfig;
  setConfig(config: ClimateDefaultsTileCardConfig): void;
  render(): unknown;
}

interface HuiTileCardEditorConstructor {
  new (): HuiTileCardEditorInstance;
  styles?: unknown;
}

let builtEditorClass: HuiTileCardEditorConstructor | undefined;

function buildEditorClass(): HuiTileCardEditorConstructor {
  if (builtEditorClass) {
    return builtEditorClass;
  }

  const BaseEditor = customElements.get(BASE_EDITOR_TAG);

  if (!BaseEditor) {
    throw new Error(
      `[${EDITOR_TAG}] Required built-in element "<${BASE_EDITOR_TAG}>" is not registered.`
    );
  }

  const BaseEditorCtor = BaseEditor as unknown as HuiTileCardEditorConstructor;

  class ClimateDefaultsTileCardEditor extends BaseEditorCtor {
    @state() private _customValues: CustomFieldValues = {};

    // Our own record of the full config (stock fields + our 3 custom ones), kept in
    // sync on every setConfig and every outgoing config-changed. We rely on this
    // instead of reading the base editor's own `_config` when building our events:
    // that field is internal to the base class (never part of the public
    // LovelaceCardEditor contract), so trusting its name/timing is fragile. Tracking
    // our own copy means our custom fields can never silently fail to round-trip
    // because of a bad assumption about the base's internals.
    private _lastConfig: ClimateDefaultsTileCardConfig | undefined;

    setConfig(config: ClimateDefaultsTileCardConfig): void {
      const {
        target_hvac_mode,
        target_temperature,
        target_fan_mode,
        ...rest
      } = config;
      this._customValues = {
        target_hvac_mode,
        target_temperature,
        target_fan_mode,
      };
      this._lastConfig = config;
      super.setConfig(rest);
    }

    private _mergeAndTrack(config: Record<string, unknown> | undefined): ClimateDefaultsTileCardConfig {
      const merged: Record<string, unknown> = {
        ...config,
        ...this._customValues,
      };
      Object.keys(merged).forEach((key) => {
        if (merged[key] === undefined) {
          delete merged[key];
        }
      });
      this._lastConfig = merged as ClimateDefaultsTileCardConfig;
      return this._lastConfig;
    }

    // The base editor's own stock-field handlers fire "config-changed" events built
    // from their own internal state, which never contains our 3 custom keys (we
    // strip them before delegating to super.setConfig above). Intercepting
    // dispatchEvent is the one place that catches every outgoing config-changed,
    // regardless of which internal handler fired it, so editing a stock field never
    // silently drops ours.
    //
    // Note: these events are frequently built with the fireEvent() helper (both
    // ours from custom-card-helpers and HA's own internal copy), which constructs a
    // plain `new Event(...)` and bolts `.detail` on as a regular property rather
    // than using `new CustomEvent(...)`. `event instanceof CustomEvent` is false for
    // those, so we deliberately don't gate on it here -- only on the event type and
    // the presence of `.detail.config`.
    dispatchEvent(event: Event): boolean {
      const detail = (event as { detail?: { config?: Record<string, unknown> } })
        .detail;
      if (event.type === "config-changed" && detail?.config) {
        const merged = this._mergeAndTrack(detail.config);
        event = new CustomEvent("config-changed", {
          detail: { config: merged },
          bubbles: event.bubbles,
          composed: event.composed,
        });
      }
      return super.dispatchEvent(event);
    }

    private _computeLabel = (schema: { name: string }): string =>
      CUSTOM_FIELD_LABELS[schema.name] ?? schema.name;

    private _customFormValueChanged(ev: CustomEvent): void {
      ev.stopPropagation();
      this._customValues = ev.detail.value;
      const merged = this._mergeAndTrack(this._lastConfig);
      // Dispatch a genuine CustomEvent directly via super (bypassing our own
      // dispatchEvent override, since we've already merged everything it would)
      // rather than going through the fireEvent() helper: fireEvent's events
      // aren't real CustomEvent instances (see the note on dispatchEvent above),
      // so building one ourselves here is the more defensive choice for the
      // event this component owns end-to-end, in case anything upstream does
      // care about the distinction.
      super.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: merged },
          bubbles: true,
          composed: true,
        })
      );
    }

    render() {
      const base = super.render();
      const entityId = this._config?.entity;
      const stateObj = entityId ? this.hass?.states[entityId] : undefined;
      const isClimate = Boolean(entityId?.startsWith("climate."));

      if (!isClimate) {
        return base;
      }

      const hvacModes: string[] = stateObj?.attributes.hvac_modes ?? [];
      const fanModes: string[] = stateObj?.attributes.fan_modes ?? [];
      const minTemp = stateObj?.attributes.min_temp;
      const maxTemp = stateObj?.attributes.max_temp;
      const step = stateObj?.attributes.target_temp_step ?? 0.5;

      const schema = [
        {
          name: "target_hvac_mode",
          selector: { select: { options: hvacModes, mode: "dropdown" } },
        },
        {
          name: "target_temperature",
          selector: {
            number: { min: minTemp, max: maxTemp, step, mode: "box" },
          },
        },
        {
          name: "target_fan_mode",
          selector: { select: { options: fanModes, mode: "dropdown" } },
        },
      ];

      return html`
        ${base}
        <ha-expansion-panel class="defaults-panel" outlined>
          <ha-svg-icon slot="leading-icon" .path=${mdiTuneVariant}></ha-svg-icon>
          <h3 slot="header">Target values</h3>
          <div class="content">
            <ha-form
              .hass=${this.hass}
              .data=${this._customValues}
              .schema=${schema}
              .computeLabel=${this._computeLabel}
              @value-changed=${this._customFormValueChanged}
            ></ha-form>
            <p class="helper">
              Tapping the icon while off commands the entity straight to this HVAC
              mode (skipping the stock turn-on), then this temperature and fan
              mode. If no target HVAC mode is set, the card falls back to
              "heat_cool" or "cool" (whichever the entity supports), or to the
              stock toggle if neither is supported.
            </p>
          </div>
        </ha-expansion-panel>
      `;
    }

    // The base editor's own styles (configElementStyle + its own `ha-form { margin-bottom:
    // 24px }` rule) already give ha-expansion-panel/.content their look; we only need to
    // add the same 24px gap above our own panel that ha-form's trailing margin gives the
    // sections before it, since our panel comes after the base's last element.
    static get styles() {
      const baseStyles = super.styles;
      return [
        ...(Array.isArray(baseStyles) ? baseStyles : baseStyles ? [baseStyles] : []),
        css`
          .defaults-panel {
            margin-top: 24px;
          }
          .helper {
            margin: 8px 0 0;
            color: var(--secondary-text-color);
            font-size: 0.875rem;
          }
        `,
      ];
    }
  }

  customElements.define(EDITOR_TAG, ClimateDefaultsTileCardEditor);
  builtEditorClass = ClimateDefaultsTileCardEditor;
  return builtEditorClass;
}

// This module is statically imported by the card module so it's bundled as one file.
// It must be safe to *evaluate* before hui-tile-card-editor exists — all lookup of the
// base class is deferred into ensureEditorRegistered()/buildEditorClass(), never at
// module top level.
export async function ensureEditorRegistered(): Promise<void> {
  if (customElements.get(EDITOR_TAG)) {
    return;
  }
  if (!customElements.get(BASE_EDITOR_TAG)) {
    await customElements.whenDefined(BASE_EDITOR_TAG);
  }
  buildEditorClass();
}
