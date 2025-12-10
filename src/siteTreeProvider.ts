import * as vscode from 'vscode';
import { loadSites } from './config';
import { modElement } from './types';
import { CategoryNode, ElementNode, ModxNode, SiteNode } from './site';

export class SiteTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _em = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._em.event;

  // cache: siteKey|type -> list
  private filterQuery: string = '';
  private cache = new Map<string, modElement[]>();

  constructor(private context: vscode.ExtensionContext) {}

  refresh(childNode?: ModxNode): void {
    this.cache.clear();
    this._em.fire(childNode);
  }


  setFilter(q: string) {
    this.filterQuery = q;
    this._em.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  } 

  async addChild(parent: CategoryNode, element: modElement): Promise<ElementNode> {
      if (!parent.children) {
          parent.children = [];
      }
      const el = new ElementNode(parent, element);
      parent.children.push(el);
      this._em.fire(parent); // Refresh only the parent and its children

      return el;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      // ROOT: Sites
      const sites = await loadSites(this.context); 
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


    return [];
  }
}
