// src/extension.ts
import * as vscode from 'vscode';
import { ModxFs } from './modxFs';
import { SiteTreeProvider } from './siteTreeProvider';
import { SiteNode } from './site';
import { openAddOrEditSiteWebview } from './webviews/addSiteWebview';
import { removeSite } from './config';
import { AxiosError } from 'axios';

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
 
    



    const refreshCommand = vscode.commands.registerCommand('vscode-modx-elements.refreshElements', (node) => { provider.refresh(node);});
    context.subscriptions.push(refreshCommand);


	const newElementCommand = vscode.commands.registerCommand('vscode-modx-elements.newElement', async (node) => {
		let type = node.type.substring(3).toLowerCase();

		
        const value = await vscode.window.showInputBox({
            prompt: `Enter name of ${type}`,
            placeHolder: `Type a name for your new ${type}`,
        });

		if(!value){
			 return;
		}

		const client = await node.site!.client();

		try{
			const res = await client.post(`/${node.type}`, { name: value });
			if(res?.data?.success){
				const elementNode = await provider.addChild(node, res.data.data);
				if(elementNode){
					vscode.commands.executeCommand('vscode.open', elementNode.resourceUri);
				}
				return;
			}

			vscode.window.showWarningMessage(res?.data?.error || 'Something went wrong');
		}catch(e: any){ 
			vscode.window.showWarningMessage(e?.response?.data?.error || 'Try another name');
		}
    });
    context.subscriptions.push(newElementCommand);

	const renameElementCommand = vscode.commands.registerCommand('vscode-modx-elements.renameElement', async (node) => {
		console.log(node);		
        const value = await vscode.window.showInputBox({
            prompt: `Change name of ${node.element.name}`,
            placeHolder: node.element.name
        }); 

		if(!value){
			 return;
		}

		const client = await node.site!.client();
		
		try{
			const res = await client.put(`/${node.type}/${node.element.id}`, { name: value });
			if(res?.data?.success){
				vscode.window.showInformationMessage(`${node.element.name} renamed to ${value}`);
				node.label = value;
				provider.refresh(node);
				return;
			}

			vscode.window.showWarningMessage(res?.data?.error || 'Something went wrong');
		}catch(e: any){ 
			vscode.window.showWarningMessage(e?.response?.data?.error || 'Try another name');
		}
    });
    context.subscriptions.push(renameElementCommand);

	const openElementCommand = vscode.commands.registerCommand('vscode-modx-elements.openElement', async (node) => {
		vscode.commands.executeCommand('vscode.open', node.resourceUri);
    });
    context.subscriptions.push(openElementCommand);

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