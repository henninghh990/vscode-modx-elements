import * as vscode from 'vscode';
import { SiteTreeProvider } from "../siteTreeProvider";
import { SiteConfig } from "../types";
import { addSite, getToken, removeSite, storeToken, updateSite } from '../config';
import axios from 'axios';


export async function openAddOrEditSiteWebview(
  context: vscode.ExtensionContext,
  provider: SiteTreeProvider,
  existingSite?: SiteConfig
) {
    const panel = vscode.window.createWebviewPanel(
        'modxAddOrEditSite',
        existingSite ? `Edit MODX Site — ${existingSite.name}` : 'Add MODX Site',
        vscode.ViewColumn.Active,
        {
            enableScripts: true,
            retainContextWhenHidden: false,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        }
    );

    const nonce = getNonce();
    //const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'addSite.js')  );

    if(existingSite?.tokenKey){
        existingSite.tokenKey = await getToken(context, existingSite.tokenKey);
    }


    panel.webview.html = getHtml(panel.webview, nonce, existingSite);
    const disposables: vscode.Disposable[] = [];
 
    panel.webview.onDidReceiveMessage(async msg => {
        console.log('msg', msg);
        try{
            if (msg.type === 'ping') {
                const { baseUrl, apiUrl, token } = msg.payload;
                
                const url = normalizeApiUrl(baseUrl, apiUrl);
                const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
                
                console.log(url);
                // enkel ping; endre eventuelt til ?ping=1 i din API
                try{
                    const res = await axios.get(url, { headers, timeout: 2000 });
                    console.log(res);
                    if(!res){
                        panel.webview.postMessage({ type: 'pingResult', ok: true, status: 'Error' });
                    }
                    panel.webview.postMessage({ type: 'pingResult', ok: true, status: res.status });
                }catch(e){
                    vscode.window.showErrorMessage(`Failed to ping: ${e}`);
                    panel.webview.postMessage({ type: 'pingResult', ok: false, status: e });
                    console.log(e);
                }
                
                
            }
            if (msg.type === 'submit') {
                const { name, baseUrl, apiUrl, elements, token } = sanitizeForm(msg.payload);

                const urlOk = isHttpUrl(baseUrl);
                if (!urlOk) {
                    panel.webview.postMessage({ type: 'submitResult', ok: false, error: 'Invalid base URL' });
                    return;
                }

                let tokenKey: string | undefined;
                if (token && token.trim()) {
                    tokenKey = `modxToken:${baseUrl}`;
                    await storeToken(context, tokenKey, token.trim());
                }

                const site: SiteConfig= {
                    name: name || 'Unnamed Site',
                    baseUrl: trimRightSlash(baseUrl),
                    apiUrl: normalizeApiPath(apiUrl),
                    elements,
                    tokenKey
                };


                
                if (existingSite) {
                    await updateSite(context, existingSite.baseUrl, site);
                    vscode.window.showInformationMessage(`Updated site: ${site.name}`);
                } else {
                    await addSite(context, site);
                    vscode.window.showInformationMessage(`Added site: ${site.name}`);
                }

                panel.webview.postMessage({ type: 'submitResult', ok: true });
                provider.refresh();
                panel.dispose();
            }

            if(msg.type === 'delete'){
                const { baseUrl } = sanitizeForm(msg.payload);
                await removeSite(context, baseUrl);
                vscode.window.showInformationMessage(`Deleted`);
                provider.refresh();
                panel.dispose();
            }
            if (msg.type === 'cancel') {
                panel.dispose();
            }
        } catch (e: any) {
            panel.webview.postMessage({ type: msg.type + 'Result', ok: false, error: String(e?.message ?? e) });
        }
    }, undefined, disposables);
}



 function getHtml(webview: vscode.Webview,  nonce: string, site?: SiteConfig): string {

    const s = site || { name: '', baseUrl: 'https://', apiUrl: 'modx-elements/', tokenKey: '', elements: ['modPlugin','modSnippet','modChunk','modTemplate'] };

    
  // CSP for enkel trygg skripting
  const csp = `
    default-src 'none';
    img-src ${webview.cspSource} https:;
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src ${webview.cspSource};
  `;

  // Minimal, tema-vennlig styling (bruk VS Code CSS-vars)
  return /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               img-src ${webview.cspSource} https:;
               style-src ${webview.cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
  :root {
    --pad: 8px;
  }
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
  h2 { margin: 0 0 12px; }
  fieldset { border: 1px solid var(--vscode-widget-border); border-radius: 6px; margin: 12px 0; padding: 12px; }
  label { display:block; margin: 8px 0 4px; }
  input[type="text"], input[type="url"], input[type="password"] {
    width: 100%; padding: 6px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
  }
    .bs-row{display: flex; justify-content: between; width: 100%;}
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .actions { display: flex; gap: 8px; margin-top: 12px; }
  button { padding: 6px 12px; cursor: pointer; }
  .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; }
  .btn-danger { background: var(--vscode-editorError-foreground); color: var(--vscode-button-foreground); border: none; }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; }
  .btn-link { background: transparent; border: none; color: var(--vscode-textLink-foreground); }
  .status { margin-top: 8px; min-height: 1.2em; color: var(--vscode-descriptionForeground); }
  .checkboxes label { display:flex; align-items:center; gap: 8px; margin: 4px 0; }
  .error { color: var(--vscode-editorError-foreground); }
  .ok { color: var(--vscode-testing-iconPassed); }
</style>
</head>
<body>
  <div class="wrap">
    <h2>${site ? 'Edit MODX Site' : 'Add MODX Site'}</h2>
    <form id="f">
      <fieldset>
        <legend>General</legend>
        <label>Name</label>
        <input name="name" type="text" value="${s.name}" placeholder="My MODX Site" required/>

        <div class="row">
          <div>
            <label>Base URL</label>
            <input name="baseUrl" type="url" value="${s.baseUrl}" placeholder="https://example.com" required/>
          </div>
          <div>
            <label>API path or full URL</label>
            <input name="apiUrl" type="text" value="${s.apiUrl}" />
          </div>
        </div>

        <label>Bearer token (optional)</label>
        <input name="token" type="password" value="${s.tokenKey || ''}" placeholder="Stored securely in system keychain"/>
        <div class="actions">
          <button type="button" id="ping" class="btn-secondary">Ping API</button>
          <span id="pingStatus" class="status"></span>
        </div>
      </fieldset>

      <fieldset>
        <legend>Elements</legend>
        <div class="checkboxes">
          <label><input type="checkbox" name="elements" value="modSnippet" ${s.elements ? (s.elements?.includes('modSnippet') ? 'checked' : '') : 'checked'}/> Snippets</label>
          <label><input type="checkbox" name="elements" value="modChunk" ${s.elements ? (s.elements?.includes('modChunk') ? 'checked' : '') : 'checked'}/> Chunks</label>
          <label><input type="checkbox" name="elements" value="modTemplate" ${s.elements ? (s.elements?.includes('modTemplate') ? 'checked' : '') : 'checked'}/> Templates</label>
          <label><input type="checkbox" name="elements" value="modPlugin" ${s.elements ? (s.elements?.includes('modPlugin') ? 'checked' : '') : ''} /> Plugins</label>
        </div>
      </fieldset>

      <div class="bs-row">
        
            <div>
                <button type="submit" class="btn-primary">${site ? 'Save changes' : 'Add'}</button>
                <button type="button" id="cancel" class="btn-link">Cancel</button>
                <span id="submitStatus" class="status"></span>
            </div>
            ${site ?
            `<div>
                <button type="button" id="delete" class="btn-danger">Remove</button>
            </div>`
            : `<input type="hidden" id="delete" />`}
       
      </div>
    </form>
    <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

$('#ping').addEventListener('click', () => {
    const payload = serialize();
    $('#pingStatus').textContent = 'Pinging...';
    vscode.postMessage({ type: 'ping', payload });
});

$('#cancel').addEventListener('click', () => {
    vscode.postMessage({ type: 'cancel' });
});
$('#delete').addEventListener('click', () => {
    const payload = serialize();
    vscode.postMessage({ type: 'delete', payload });
});
$('#f').addEventListener('submit', (e) => {
    e.preventDefault();
    const payload = serialize();
    console.log('submit payload', payload);
    $('#submitStatus').textContent = 'Saving...';
    vscode.postMessage({ type: 'submit', payload });
});

window.addEventListener('message', (e) => {
    const msg = e.data;
    console.log('message', e);
    if (msg.type === 'pingResult') {
        if (msg.ok) {
            $('#pingStatus').textContent = 'OK (' + msg.status + ')';
            $('#pingStatus').className = 'status ok';
        } else {
            $('#pingStatus').textContent = 'Failed: ' + (msg.error || 'Unknown');
            $('#pingStatus').className = 'status error';
        }
    }
    if (msg.type === 'submitResult') {
    if (msg.ok) {
        $('#submitStatus').textContent = 'Saved';
        $('#submitStatus').className = 'status ok';
    } else {
        $('#submitStatus').textContent = 'Error: ' + (msg.error || 'Unknown');
        $('#submitStatus').className = 'status error';
    }
    }
});

function serialize() {
    const fd = new FormData($('#f'));
    const els = $$('#f input[name="elements"]:checked').map(i => i.value);
    return {
        name: fd.get('name') || '',
        baseUrl: (fd.get('baseUrl') || '').toString().trim(),
        apiUrl: (fd.get('apiUrl') || '').toString().trim(),
        token: (fd.get('token') || '').toString(),
        elements: els
    };
}
    </script>
  </div>
</body>
</html>
`;
}

function isHttpUrl(v: string): boolean {
  try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; }
  catch { return false; }
}
function trimRightSlash(s: string) { return s.replace(/\/+$/, ''); }
function normalizeApiPath(api: string) {
  if (!api) {return 'vscode-api/';}
  if (/^https?:\/\//i.test(api)) {return api.replace(/\/+$/, '') + '/';}
  return api.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
}
function normalizeApiUrl(base: string, api: string) {
  if (/^https?:\/\//i.test(api)) {return api;} // full URL
  return `${trimRightSlash(base)}/${normalizeApiPath(api)}ping`;
}
function sanitizeForm(p: any) {
  const name = String(p.name ?? '').trim();
  const baseUrl = String(p.baseUrl ?? '').trim();
  const apiUrl = String(p.apiUrl ?? '').trim();
  const token = String(p.token ?? '').trim();
  const elements = Array.isArray(p.elements) && p.elements.length
    ? p.elements.map((c: any) => String(c))
    : ['modSnippet', 'modChunk', 'modTemplate', 'modPlugin'];
  return { name, baseUrl, apiUrl, token, elements };
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; for (let i = 0; i < 32; i++){
    s += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return s;
}

