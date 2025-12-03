import * as vscode from 'vscode';
import { loadSites } from './config';
import { modElement, SiteConfig } from './types';
import { CategoryNode, SiteNode } from './site';

export class SiteTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _em = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._em.event;

  // cache: siteKey|type -> liste
  private filterQuery: string = '';
  private cache = new Map<string, modElement[]>();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this.cache.clear();
    this._em.fire();
  }


  setFilter(q: string) {
    this.filterQuery = q;
    this._em.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // ROOT: Sites
      const sites = await loadSites(this.context); // ← returnerer SiteConfig[]
      if (!sites || sites.length === 0) {
        vscode.commands.executeCommand('setContext', 'vscode-modx-elements.noSitesConfigured', true);
        return [];
      }
      vscode.commands.executeCommand('setContext', 'vscode-modx-elements.noSitesConfigured', false);
      return sites.map(s => new SiteNode(s, this.context));
    }

    

    if (element instanceof SiteNode) {
      return element.getCategories();
    }
 
    if (element instanceof CategoryNode) {
      return element.getElements(this.filterQuery);
    }

    // ElementNodes har ingen barn
    return [];
  }
}
