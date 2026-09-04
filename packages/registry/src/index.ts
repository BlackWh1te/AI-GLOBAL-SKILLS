import fs from 'fs';
import path from 'path';

export interface CatalogComponent {
  id: string;
  name: string;
  kind: string;
  summary: string;
  capabilities: string[];
  keywords: string[];
  project_files: string[];
  platforms: string[];
  source: {
    type: string;
    locator: string;
    license: string | null;
    revision: string | null;
  };
  install: {
    mode: string;
    requires_confirmation: boolean;
  };
  risk: string;
  status: string;
}

export interface Catalog {
  schema_version: string;
  generated_at: string;
  components: CatalogComponent[];
}

export class RegistryClient {
  private catalogPath: string;

  constructor(catalogPath?: string) {
    // Default to the project root's registries/catalog.json
    this.catalogPath = catalogPath || path.join(process.cwd(), '../../registries/catalog.json');
  }

  public getCatalog(): Catalog {
    if (!fs.existsSync(this.catalogPath)) {
      throw new Error(`Catalog not found at ${this.catalogPath}`);
    }
    const data = fs.readFileSync(this.catalogPath, 'utf8');
    return JSON.parse(data) as Catalog;
  }

  public search(query: string): CatalogComponent[] {
    const catalog = this.getCatalog();
    const q = query.toLowerCase();
    return catalog.components.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.summary.toLowerCase().includes(q) || 
      c.keywords.some(k => k.toLowerCase().includes(q)) ||
      c.capabilities.some(cap => cap.toLowerCase().includes(q))
    );
  }
}

export interface NpmSearchResult {
  name: string;
  version: string;
  description: string;
  author: string;
  date: string;
  links: { npm: string; homepage?: string; repository?: string };
}

export class NpmScanner {
  public async searchMcpServers(query: string = ''): Promise<NpmSearchResult[]> {
    try {
      // NPM registry search API, looking for 'mcp-server' keyword + optional text
      const textParam = query ? `${query}+keywords:mcp-server` : 'keywords:mcp-server';
      const url = `https://registry.npmjs.org/-/v1/search?text=${textParam}&size=50`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`NPM API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.objects.map((obj: any) => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description,
        author: obj.package.author?.name || 'Unknown',
        date: obj.package.date,
        links: obj.package.links
      }));
    } catch (err) {
      console.error('NPM Scanner error:', err);
      return [];
    }
  }
}
