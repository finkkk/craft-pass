export interface PublicSiteConfig {
  name: string;
  subtitle: string;
}

export interface SetupStatus {
  setupRequired: boolean;
  runtimeConfigPresent: boolean;
  site: PublicSiteConfig;
}

export interface CompleteSetupPayload {
  setupToken: string;
  siteName: string;
  siteSubtitle: string;
  admin: {
    username: string;
    password: string;
  };
  rcon: {
    enabled: boolean;
    host: string;
    port: number;
    password: string;
    timeoutMs: number;
    whitelistAddCommand: string;
    whitelistReloadCommand: string;
  };
}
