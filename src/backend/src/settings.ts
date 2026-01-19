import { BulkerSettings } from "../../shared/types";

export const DEFAULT_SETTINGS: BulkerSettings = {
  followRedirects: false,
  threads: 20,
  randomUserAgent: false,
  httpMethod: "GET",
  timeout: 30,
  retryCount: 0,
  customHeaders: [],
  customQueryParams: []
};

export class SettingsStore {
  private settings: BulkerSettings = { ...DEFAULT_SETTINGS };

  public getSettings(): BulkerSettings {
    return this.settings;
  }

  public updateSettings(newSettings: BulkerSettings): void {
    this.settings = { ...newSettings };
  }
}
