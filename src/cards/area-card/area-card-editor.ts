import { LitElement, html, type TemplateResult } from "lit";
import { state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardEditor } from "custom-card-helpers";
import { badgeMode, migrateConfig } from "./config";
import {
  BADGE_DEVICE_CLASSES,
  BADGE_KEYS,
  BADGE_LABELS,
  DEFAULT_BACKGROUND_ICON_SIZE,
  EDITOR_TAG,
  NUMERIC_BADGES,
  type AreaCardConfig,
  type BadgeKey,
} from "./types";

const BASE_SCHEMA = [
  { name: "area", selector: { area: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "hide_icon", selector: { boolean: {} } },
  { name: "devices", selector: { entity: { multiple: true } } },
  { name: "background", selector: { boolean: {} } },
  { name: "background_icon_size", selector: { number: { min: 20, max: 200, mode: "box" } } },
];

const MODE_OPTIONS = [
  { value: "area", label: "Area default" },
  { value: "hide", label: "Hide" },
  { value: "entities", label: "Specific sensors" },
];

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
      [key, BADGE_LABELS[key]],
      [`${key}_entities`, `${BADGE_LABELS[key]} sensors`],
    ])
  ),
};

function isNumericBadge(key: BadgeKey): boolean {
  return (NUMERIC_BADGES as readonly string[]).includes(key);
}

function entityFilter(key: BadgeKey) {
  const device_class = [...BADGE_DEVICE_CLASSES[key]];
  return isNumericBadge(key)
    ? [{ domain: "sensor", device_class }, { domain: "climate" }]
    : [{ domain: "binary_sensor", device_class }];
}

function badgeSchema(config: AreaCardConfig) {
  return BADGE_KEYS.flatMap((key) => [
    { name: key, selector: { select: { mode: "dropdown", options: MODE_OPTIONS } } },
    ...(badgeMode(config, key) === "entities"
      ? [
          {
            name: `${key}_entities`,
            selector: { entity: { multiple: true, filter: entityFilter(key) } },
          },
        ]
      : []),
  ]);
}

export class AreaCardEditor extends LitElement implements LovelaceCardEditor {
  hass?: HomeAssistant;

  @state() private _config?: AreaCardConfig;

  setConfig(config: AreaCardConfig): void {
    this._config = migrateConfig(config);
  }

  private _computeLabel = (schema: { name: string }): string =>
    LABELS[schema.name] ?? schema.name;

  // Shows the implicit defaults in the form even before the user has
  // touched them.
  private _formData(config: AreaCardConfig): AreaCardConfig {
    return {
      background: true,
      background_icon_size: DEFAULT_BACKGROUND_ICON_SIZE,
      ...Object.fromEntries(BADGE_KEYS.map((key) => [key, badgeMode(config, key)])),
      ...config,
    };
  }

  // Keeps the saved YAML minimal: "area" is the default mode, and a sensor
  // list only matters in "entities" mode.
  private _cleanBadges(config: AreaCardConfig): AreaCardConfig {
    const cleaned: AreaCardConfig = { ...config };
    for (const key of BADGE_KEYS) {
      const entitiesKey = `${key}_entities`;
      if (!cleaned[key] || cleaned[key] === "area") {
        delete cleaned[key];
      }
      if (cleaned[key] !== "entities" || !cleaned[entitiesKey]?.length) {
        delete cleaned[entitiesKey];
      }
    }
    return cleaned;
  }

  private _valueChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    const config = this._cleanBadges(ev.detail.value as AreaCardConfig);
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
    const schema = [
      ...BASE_SCHEMA,
      {
        name: "badges",
        type: "expandable",
        flatten: true,
        title: "Status badges",
        schema: badgeSchema(this._config),
      },
    ];
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._formData(this._config)}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, AreaCardEditor);
}
