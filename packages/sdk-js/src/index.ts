// @lenati/sdk-js: a small typed client for the public API (/api/v1). The Kotlin SDK mirrors it.
export interface Hall { id: string; name: string; blurb: string | null; order: number; open: boolean }
export interface NodeSummary { id: string; name: string; commonName?: string | null; level: string; system?: string | null; deeperId?: string | null }

export class Lenati {
  constructor(private base = 'https://lenati.app', private fetcher: typeof fetch = fetch) {}
  private async get<T>(path: string): Promise<T> {
    const r = await this.fetcher(`${this.base.replace(/\/$/, '')}/api/v1${path}`);
    if (!r.ok) throw new Error(`Lenati API ${r.status} on ${path}`);
    return ((await r.json()) as { data: T }).data;
  }
  halls() { return this.get<Hall[]>('/halls'); }
  node(id: string) { return this.get<NodeSummary & Record<string, unknown>>(`/nodes/${encodeURIComponent(id)}`); }
  children(id: string, skip = 0, take = 50) { return this.get<NodeSummary[]>(`/nodes/${encodeURIComponent(id)}/children?skip=${skip}&take=${take}`); }
  search(q: string) { return this.get<NodeSummary[]>(`/search?q=${encodeURIComponent(q)}`); }
}
