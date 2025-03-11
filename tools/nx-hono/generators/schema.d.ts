export type SupportedHonoBackendServer = 'node' | 'deno' | 'nextjs';

export interface HonoBackendGeneratorSchema {
  name: string;
  server: SupportedHonoBackendServer;
}
