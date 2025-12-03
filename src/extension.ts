// src/extension.ts
import * as vscode from 'vscode';
import { ModxFs } from './modxFs';
import { SiteTreeProvider } from './siteTreeProvider';
import { SiteNode } from './site';
import { openAddOrEditSiteWebview } from './webviews/addSiteWebview';
import { removeSite } from './config';

export async function activate(context: vscode.ExtensionContext) {
    
    // 1. Registrer FileSystemProvider og TreeView
    const provider = new SiteTreeProvider(context);
    const fs = new ModxFs(context);

    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider('modx', fs, { isCaseSensitive: true })
    );

    const treeView = vscode.window.createTreeView('modx-elements-tree', {
        treeDataProvider: provider
    });
    context.subscriptions.push(treeView);
 
    



    const refreshCommand = vscode.commands.registerCommand('vscode-modx-elements.refreshElements', () => { provider.refresh();});
    context.subscriptions.push(refreshCommand);


	const newElementCommand = vscode.commands.registerCommand('vscode-modx-elements.newElement', async (node) => {
		console.log(node);
        const value = await vscode.window.showInputBox({
            prompt: 'Enter name of snippet',
            placeHolder: 'Type to search',
        });

  		//POST `/`
    });
    context.subscriptions.push(newElementCommand);

    // Search command – live filtrering med QuickInput
    const searchCommand = vscode.commands.registerCommand('vscode-modx-elements.searchElements', async () => {
        const value = await vscode.window.showInputBox({
            prompt: 'Filter elements by name/content…',
            placeHolder: 'Type to search',
            ignoreFocusOut: true
        });

  		provider.setFilter(value?.trim() ?? '');
  		vscode.commands.executeCommand('setContext', 'vscode-modx-elements.hasActiveFilter', !!value?.trim());
    });
    context.subscriptions.push(searchCommand);




  	// Clear search
  	const clearSearchCommand = vscode.commands.registerCommand('vscode-modx-elements.clearSearch', () => {
    	provider.setFilter('');
    	vscode.commands.executeCommand('setContext', 'vscode-modx-elements.hasActiveFilter', false);
  	});
  	context.subscriptions.push(clearSearchCommand);


	// Add site
	const addSiteCommand = vscode.commands.registerCommand('vscode-modx-elements.addModxSite', async () => {
			await openAddOrEditSiteWebview(context, provider);
  		}
	);
	context.subscriptions.push(addSiteCommand);


	// Edit site
	const editSiteCommand = vscode.commands.registerCommand('vscode-modx-elements.editModxSite', async (node: SiteNode) => {
		if (!node || !node.siteCfg) {
			vscode.window.showWarningMessage('No MODX site selected.');
			return;
		}

		await openAddOrEditSiteWebview(context, provider, node.siteCfg);
	});
	context.subscriptions.push(editSiteCommand);



	// delete site
	const deleteSiteCommand = vscode.commands.registerCommand('vscode-modx-elements.deleteModxSite', async (node: SiteNode) => {
		if (!node || !node.site?.baseUrl) {
			vscode.window.showWarningMessage('No MODX site selected.');
			return;
		}
		await removeSite(context, node.site.baseUrl);

	});
	context.subscriptions.push(deleteSiteCommand);
}

export function deactivate() {}