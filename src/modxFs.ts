// src/modxFs.ts
import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { loadSites } from './config';
import { ModxSite } from './site';

export class ModxFs implements vscode.FileSystemProvider {
  private _em = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public client: AxiosInstance | null = null;
  public sitename: string = '';
  public type: string = '';
  public id: number | null = null;
  public name: string = '';   

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._em.event;

  constructor(private context: vscode.ExtensionContext) {}

  private async init(uri: vscode.Uri) {
    this.parse(uri);
    this.client = await this.getClient();

  }
  private async getClient(): Promise<AxiosInstance | null> {
    const sites = await loadSites(this.context);

    const siteCfg = sites.find((s) => s.name === this.sitename); 

    const site = new ModxSite(siteCfg!, this.context);
    
    if(site){
        return site.client(); 
    }

    return null;
  } 

  // Hjelper: map URI -> { type, id, name }
  private parse(uri: vscode.Uri) {
    // /<type>/<id>/<encodedName>[.<ext>]
    const [, sitename, type, idStr, rest] = uri.path.split('/');
    if (!sitename || !type || !idStr || !rest) {throw vscode.FileSystemError.FileNotFound(uri);}
    const id = Number(idStr);
    const encodedName = rest.replace(/\.[^.]+$/, ''); // fjern evt. .js/.html osv
    const name = decodeURIComponent(encodedName);
    
    this.sitename = sitename;
    this.type = type;
    this.id = id;
    this.name = name;
  }

  // ==== Påkrevd API ====

  watch(): vscode.Disposable {
    // Ingen server-push her; retur no-op
    return new vscode.Disposable(() => {});
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    // Vi kan gjøre et lett HEAD/ping om ønskelig.
    // For enkelhet: anta en "fil" med dummy størrelse/tid.
    return {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    };
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    // Hvis du vil browse i Explorer via modx:, kan du returnere kategorier/elementer her.
    // Ikke nødvendig for bare "åpne konkrete URIs" fra treet.
    return [];
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    this.init(uri); 
    if(!this.client) { throw vscode.FileSystemError.FileNotFound(uri); }

    const { data } = await this.client.get(`/${this.type}/${this.id}`);
    
    const content = (data?.data && data.data?.content) ? String(data.data.content) : '';
    return Buffer.from(content, 'utf8');
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
    this.init(uri);
     
    const body = {
      name: this.name,
      content: Buffer.from(content).toString('utf8'),
    };
    
    try {
        const res = await this.client?.put(`/${this.type}/${this.id}`, body, {maxRedirects: 0});
        if(!res?.data?.success) {
          throw Error(res?.data?.error || 'Something went wrong');
        }
        
    } catch (err: any) {
        console.log(err);
        const r = err.response;
        console.log('Status:', r?.status);
        console.log('Location:', r?.headers?.location);
        // 301/302/303 + Location => du er i redirect-fella
    }
    
    this._em.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  // Ikke brukt nå, men må finnes i interfacet:
  createDirectory(): void | Thenable<void> { /* no-op */ }
  delete(): void | Thenable<void> { /* no-op (eller kall API) */ }
  rename(): void | Thenable<void> { /* no-op (eller kall API) */ }
}
