export type SiteConfig = {
  name: string;
  baseUrl: string;
  apiUrl: string;          // f.eks. https://example.com/vscode-api/
  elements?: ModElementType[], // ['modSnippet', 'modChunk', ...]
  tokenKey?: string;   // nøkkel i SecretStorage (valgfritt)
};

export type modElement = { 
    id: number; 
    name: string; 
    content?: string; 
    type: string 
};

export type ModElementType = null | 'modChunk' | 'modSnippet' | 'modTemplate' | 'modPlugin'