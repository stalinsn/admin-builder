// Small client-safe runtime config helpers
export type DataSource = 'app' | 'local' | 'vtexMock' | 'vtexLive';

export const dataSource: DataSource = (process.env.NEXT_PUBLIC_DATA_SOURCE as DataSource) || 'app';

export function isVtexLive() {
  return dataSource === 'vtexLive';
}
