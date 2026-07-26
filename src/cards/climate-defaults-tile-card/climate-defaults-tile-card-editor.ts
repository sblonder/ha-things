import { css, html } from "lit";
import { state } from "lit/decorators.js";
import { mdiTuneVariant } from "@mdi/js";
import { fireEvent, type HomeAssistant } from "custom-card-helpers";
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
      super.setConfig(rest);
    }

    // The base editor's own stock-field handlers fire "config-changed" events built
    // from its own private _config, which never contains our 3 custom keys (we strip
    // them before delegating to super.setConfig above). Intercepting dispatchEvent is
    // the one place that catches every outgoing config-changed, regardless of which
    // internal handler fired it, so editing a stock field never silently drops ours.
    dispatchEvent(event: Event): boolean {
      if (
        event instanceof CustomEvent &&
        event.type === "config-changed" &&
        event.detail?.config
      ) {
        const merged: Record<string, unknown> = {
          ...event.detail.config,
          ...this._customValues,
        };
        Object.keys(merged).forEach((key) => {
          if (merged[key] === undefined) {
            delete merged[key];
          }
        });
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
      fireEvent(this, "config-changed" as any, {
        config: this._config,
      });
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
