import { css } from "lit";

export const styles = css`
  :host {
    display: block;
    height: 100%;
  }

  ha-card {
    position: relative;
    overflow: hidden;
    height: 100%;
    box-sizing: border-box;
    padding: 12px;
    display: flex;
    flex-direction: column;
  }

  .background {
    position: absolute;
    top: -8px;
    right: -8px;
    --mdc-icon-size: 100%;
    color: var(--secondary-text-color);
    opacity: 0.12;
    pointer-events: none;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 1;
  }

  .header ha-icon {
    color: var(--paper-item-icon-color, #44739e);
  }

  .name {
    font-size: 1rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    margin-top: 8px;
    z-index: 1;
  }

  .badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1rem;
    color: var(--ha-color-neutral-50, var(--secondary-text-color));
  }

  .badge ha-icon {
    --mdc-icon-size: 21px;
  }

  .badge.problems {
    cursor: pointer;
    color: var(--error-color);
  }

  .spacer {
    flex: 1;
  }

  .devices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    z-index: 1;
  }

  .device {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 12px;
    background: rgba(var(--rgb-primary-text-color, 0, 0, 0), 0.05);
    padding: 0;
    cursor: pointer;
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
  }

  .device[active] {
    background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.15);
  }

  .device state-badge {
    --mdc-icon-size: 22px;
  }
`;
