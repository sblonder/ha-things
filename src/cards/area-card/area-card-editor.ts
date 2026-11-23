import { LitElement, html, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { migrateConfig } from "./config";
import {
  BADGE_KEYS,
  BADGE_LABELS,
  DEFAULT_BACKGROUND_ICON_SIZE,
  EDITOR_TAG,
  NUMERIC_BADGES,
  type AreaCardConfig,
  type BadgeKey,
} from "./types";

const LABELS: Record<string, string> = {
  area: "Area",
  name: "Name",
  icon: "Icon",
  hide_icon: "Hide title icon",
  devices: "Devices",
  background: "Show background icon",
  background_icon_size: "Background icon size (px)",
  ...Object.fromEntries(
    BADGE_KEYS.flatMap((key) => [
      [`${key}_entities`, `${BADGE_LABELS[key]} sensors`],
      [`hide_${key}`, `Hide ${BADGE_LABELS[key].toLowerCase()} badge`],
    ])
  ),
};

const ENTITIES_HELPER = "Leave empty to use the area default";

function entityFilter(key: BadgeKey) {
  return (NUMERIC_BADGES as readonly string[]).includes(key)
    ? [{ domain: "sensor" }, { domain: "climate" }]
    : [{ domain: "binary_sensor" }];
}

const BADGE_SCHEMA = BADGE_KEYS.flatMap((key) => [
  { name: `${key}_entities`, selector: { entity: { multiple: true, filter: entityFilter(key) } } },
  { name: `hide_${key}`, selector: { boolean: {} } },
]);

export class AreaCardEditor extends LitElement implements LovelaceCardEditor {
  hass?: HomeAssistant;

  @state() private _config?: AreaCardConfig;

  setConfig(config: AreaCardConfig): void {
    this._config = migrateConfig(config);
  }

  private _computeLabel = (schema: { name: string }): string =>
    LABELS[schema.name] ??
    (this.hass?.states[schema.name]?.attributes.friendly_name as string | undefined) ??
    schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined =>
    schema.name.endsWith("_entities") ? ENTITIES_HELPER : undefined;

  private _schema(config: AreaCardConfig) {
    const devices = config.devices ?? [];
    return [
      { name: "area", selector: { area: {} } },
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
      { name: "hide_icon", selector: { boolean: {} } },
      { name: "devices", selector: { entity: { multiple: true } } },
      ...(devices.length > 0
        ? [
            {
              // Not flattened: ha-form nests these fields under `device_icons`,
              // which yields the entity id -> icon map directly.
              name: "device_icons",
              type: "expandable",
              title: "Device icons",
              schema: devices.map((entityId) => ({
                name: entityId,
                selector: {
                  icon: {
                    placeholder: this.hass?.states[entityId]?.attributes.icon as
                      | string
                      | undefined,
                  },
                },
              })),
            },
          ]
        : []),
      { name: "background", selector: { boolean: {} } },
      { name: "background_icon_size", selector: { number: { min: 20, max: 200, mode: "box" } } },
      {
        name: "badges",
        type: "expandable",
        flatten: true,
        title: "Status badges",
        schema: BADGE_SCHEMA,
      },
    ];
  }

  // Shows the implicit defaults in the form even before the user has
  // touched them.
  private _formData(config: AreaCardConfig): AreaCardConfig {
    return {
      background: true,
      background_icon_size: DEFAULT_BACKGROUND_ICON_SIZE,
      ...config,
    };
  }

  // Keeps the saved YAML minimal: drops empty sensor lists, unset hide flags,
  // and icons that are empty or belong to removed devices.
  private _clean(config: AreaCardConfig): AreaCardConfig {
    const cleaned: AreaCardConfig = { ...config };
    for (const key of BADGE_KEYS) {
      if (!cleaned[`${key}_entities`]?.length) {
        delete cleaned[`${key}_entities`];
      }
      if (!cleaned[`hide_${key}`]) {
        delete cleaned[`hide_${key}`];
      }
    }
    const devices = cleaned.devices ?? [];
    const icons = Object.fromEntries(
      Object.entries(cleaned.device_icons ?? {}).filter(
        ([entityId, icon]) => icon && devices.includes(entityId)
      )
    );
    if (Object.keys(icons).length > 0) {
      cleaned.device_icons = icons;
    } else {
      delete cleaned.device_icons;
    }
    return cleaned;
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const config = this._clean(ev.detail.value as AreaCardConfig);
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true,
      })
    );
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) {
      return html``;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._formData(this._config)}
        .schema=${this._schema(this._config)}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, AreaCardEditor);
}
