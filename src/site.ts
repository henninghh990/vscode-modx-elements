/* eslint-disable curly */
import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { ModElementType, SiteConfig, modElement } from './types';
import { getToken } from './config';

export class ModxSite {
    public name: string;
    public baseUrl: string;
    public apiUrl: string;
    public elements?: ModElementType[];
    public tokenKey?: string;
    public accessToken?: string;

  constructor(
    public readonly cfg: SiteConfig, 
    public context?: vscode.ExtensionContext
) {
    this.name = cfg.name;
    this.baseUrl = cfg.baseUrl;
    this.apiUrl = cfg.apiUrl;
    this.elements = cfg.elements;
    this.tokenKey = cfg.tokenKey;
  }



  
  apiBase(): string {
    // full URL eller base+path
    if (/^https?:\/\//i.test(this.cfg.apiUrl)) return this.cfg.apiUrl.replace(/\/+$/, '') + '/';
    return `${this.cfg.baseUrl.replace(/\/+$/, '')}/${this.cfg.apiUrl.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
  }

  
  async client(): Promise<AxiosInstance> {
    let token = null;
    if(this.tokenKey && this.context){
        token = await getToken(this.context, this.tokenKey);
    }
    return axios.create({
      baseURL: this.apiBase(),
      timeout: 8000,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
  }
}

export abstract class ModxNode extends vscode.TreeItem {
  /** Pek til ModxSite når det finnes (settes i subklasser) */
  public site?: ModxSite;
  children: ModxNode[];
  type: ModElementType;


  protected constructor(
    label: string | vscode.TreeItemLabel,
    collapsible: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsible);
	this.children = [];
	this.type = null;
  }

  refresh(){

  }
}



export class SiteNode extends ModxNode {
  constructor(public readonly siteCfg: SiteConfig, public readonly context: vscode.ExtensionContext) {
    super(siteCfg.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.site = new ModxSite(siteCfg, context);  // én instans pr. site
    this.tooltip = siteCfg.baseUrl;
    this.contextValue = 'modxSite';
    this.iconPath = new vscode.ThemeIcon('globe');
  }

  getCategories(): CategoryNode[] {
    const types = this.siteCfg.elements ?? ['modSnippet','modChunk','modTemplate','modPlugin'];
    return types.map(type => new CategoryNode(this, type)); // send parent
  }
}


export class CategoryNode extends ModxNode {
    constructor(
        public readonly parent: SiteNode, 
        public readonly type: ModElementType
    ) {
        super(displayName(type).name, vscode.TreeItemCollapsibleState.Collapsed);
        this.site = parent.site; // gjenbruk samme ModxSite
        const stats = displayName(type);
        this.contextValue = 'modxCategory';
        this.iconPath = new vscode.ThemeIcon(stats.icon);
        this.tooltip = `${stats.name} — ${this.site?.name}`;
		this.children = [];
    }

	

    async fetchElements(): Promise<modElement[]> {

        try{
            const client = await this.site!.client();
            const { data } = await client.get(`/${this.type}`, { params: { type: this.type } });
            const rows: modElement[] = Array.isArray(data.data) ? data.data : [];
            return rows;
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to fetch ${this.type} from ${this.site?.name}: ${e}`);
            return [];
        }
    }

    async getElements(filterQuery: string): Promise<ElementNode[]> {
        const elements = await this.filter(filterQuery);
        
  
        return elements.map(el => new ElementNode(this, el));
    }

    async filter(query: string): Promise<modElement[]> {
		const list = await this.fetchElements();

		if(!query || !query.length){
			return list;
		}

        const q = query.toLowerCase();

        const filtered = list.filter(el => {
            const hitName = el.name.toLowerCase().includes(q);
            const hitContent = (el.content ?? '').toLowerCase().includes(q);
            return hitName || hitContent;
        });
        

        const items = filtered.map(el => {
            const labelText = el.name;
            const lower = labelText.toLowerCase();
            const start = lower.indexOf(query.toLowerCase());
            const lbl: vscode.TreeItemLabel = start >= 0
                ? { label: labelText, highlights: [[start, start + query.length]] }
                : { label: labelText };
            el.name = lbl.label;
            return el;
            
        });

        return items;
    }
}

// Element-nivå (konkrete MODX-objekter)
export class ElementNode extends ModxNode {
  	constructor(
    	public readonly parent: CategoryNode,
    	public readonly element: modElement
  	) 
	{
		super(element.name, vscode.TreeItemCollapsibleState.None);
		this.site = parent.site;
		this.contextValue = 'modxElement';
		this.tooltip = `${element.name} (${parent.type})`;
		this.type = parent.type;

    	this.resourceUri = this.createResourceURI();

    	this.command = { command: 'vscode.open', title: 'Open', arguments: [this.resourceUri] };
  	}

  	createResourceURI(){
      	const ext = this.parent.type === 'modSnippet' || this.parent.type === 'modPlugin' ? '.php' : '.html';

      	return vscode.Uri.from({  
      		scheme: 'modx',
      		path: `/${this.site?.name}/${this.parent.type}/${this.element.id}/${encodeURIComponent(this.element.name)}${ext}`,
    	}); 
  	}
}

function displayName(modxType: ModElementType): {name: string; icon: string} {
  switch (modxType) {
    case 'modSnippet': return {name: 'Snippets', icon: 'code'};
    case 'modChunk': return {name: 'Chunks', icon: 'extensions'};
    case 'modTemplate': return {name: 'Templates', icon: 'split-vertical'};
    case 'modPlugin': return {name: 'Plugins', icon: 'gear'};
    default: return {name: modxType || 'No name', icon: 'question'};
  }
}