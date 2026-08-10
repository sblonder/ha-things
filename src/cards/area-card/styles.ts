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
    container-type: inline-size;
    container-name: area-card;
  }

  .background {
    position: absolute;
    top: -10%;
    right: -10%;
    width: 65%;
    height: 65%;
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
    gap: 4px 12px;
    margin-top: 8px;
    z-index: 1;
  }

  .badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  .badge ha-icon {
    --mdc-icon-size: 16px;
  }

  .badge.problems {
    cursor: pointer;
  }

  .badge.problems[active] {
    color: var(--error-color);
  }

  .spacer {
    flex: 1;
  }

  .devices {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 8px;
    z-index: 1;
  }

  .device {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 2 / 1;
    border: none;
    border-radius: 12px;
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
    cursor: pointer;
    padding: 0;
  }

  .device ha-state-icon {
    --mdc-icon-size: 24px;
  }

  /* Compact (3-wide) layout: keep only the first 2 of up to 4 device slots. */
  @container area-card (max-width: 340px) {
    .devices .device:nth-child(n + 3) {
      display: none;
    }
  }
`;
