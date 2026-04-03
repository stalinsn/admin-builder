export type GameDeliveryChannel = 'dev' | 'staging' | 'production';

export type GameDeliverySettings = {
  schemaVersion: number;
  updatedAt: string;
  publicationEnabled: boolean;
  gatewayMode: 'direct-panel' | 'simulated';
  channel: GameDeliveryChannel;
  contentVersion: string;
  minSupportedVersion: string;
  currentPatchId: string;
  featuredEventIds: string[];
  releaseNotes: string;
  publishedAt?: string;
  lastPayloadHash?: string;
};

export type GameDeliveryEntityFeed = {
  entitySlug: string;
  entityLabel: string;
  source: 'database' | 'imports' | 'empty';
  count: number;
  records: Record<string, unknown>[];
};

export type GameDeliveryManifest = {
  channel: GameDeliveryChannel;
  contentVersion: string;
  minSupportedVersion: string;
  currentPatchId: string;
  publicationEnabled: boolean;
  gatewayMode: 'direct-panel' | 'simulated';
  publishedAt?: string;
  generatedAt: string;
  payloadHash: string;
  totalEntities: number;
  totalRecords: number;
  activeEventIds: string[];
};

export type GameDeliveryBundle = {
  generatedAt: string;
  manifest: GameDeliveryManifest;
  releaseNotes: string;
  cards: GameDeliveryEntityFeed[];
  config: GameDeliveryEntityFeed[];
  world: GameDeliveryEntityFeed[];
  events: {
    featuredEventIds: string[];
    liveOps: Record<string, unknown>[];
    patches: Record<string, unknown>[];
  };
};
