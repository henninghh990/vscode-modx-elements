import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SiteConfig } from './types';

const SITES_FILE = 'sites.json';


async function ensureStorageFile(context: vscode.ExtensionContext) {
  await vscode.workspace.fs.createDirectory(context.globalStorageUri);
  const fileUri = vscode.Uri.joinPath(context.globalStorageUri, SITES_FILE);
  try { await vscode.workspace.fs.stat(fileUri); }
  catch { await vscode.workspace.fs.writeFile(fileUri, Buffer.from('[]','utf8')); }
  return fileUri;
}


async function getSitesFile(context: vscode.ExtensionContext) {
  const file = path.join(context.globalStorageUri.fsPath, 'sites.json');

  console.log(file);
    // Sørg for at mappen finnes
    await vscode.workspace.fs.createDirectory(context.globalStorageUri);

    // Hvis fila ikke finnes, lag tom array
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(file));
    } catch {
        await vscode.workspace.fs.writeFile(vscode.Uri.file(file), Buffer.from('[]', 'utf8'));
    }

    return file;
}

export async function loadSites(context: vscode.ExtensionContext): Promise<SiteConfig[]> {
  const fileUri = await ensureStorageFile(context);
  const buf = await vscode.workspace.fs.readFile(fileUri);
  try { return JSON.parse(Buffer.from(buf).toString('utf8')); }
  catch { return []; }
}

export async function saveSites(context: vscode.ExtensionContext, sites: any[]) {
    const file = await getSitesFile(context);
    await fs.promises.writeFile(file, JSON.stringify(sites, null, 2), 'utf8');
}


export async function addSite(context: vscode.ExtensionContext, site: SiteConfig): Promise<SiteConfig[]> {
  const fileUri = await ensureStorageFile(context);
  const sites = await loadSites(context);
  sites.push(site);
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(sites, null, 2), 'utf8'));
  return sites;
}

export async function updateSite(
  context: vscode.ExtensionContext,
  oldBaseUrl: string,
  newData: SiteConfig
): Promise<void> {
  const sites = await loadSites(context);
  const idx = sites.findIndex(s => s.baseUrl === oldBaseUrl);
  if (idx === -1){
    throw new Error('Site not found');
  }
  sites[idx] = newData;
  await saveSites(context, sites);
}

export async function removeSite(
  context: vscode.ExtensionContext,
  baseUrl: string,
): Promise<void> { 
  const sites = await loadSites(context);
  const idx = sites.findIndex(s => s.baseUrl === baseUrl);
  if (idx === -1){
    throw new Error('Site not found, did you change the name?');
  }
  sites.splice(idx, 1);
  await saveSites(context, sites);
}

export async function storeToken(context: vscode.ExtensionContext, tokenKey: string, token: string) {
  await context.secrets.store(tokenKey, token);
}
export async function getToken(context: vscode.ExtensionContext, tokenKey: string) {
  return context.secrets.get(tokenKey);
}