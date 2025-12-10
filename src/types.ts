export type SiteConfig = {
  name: string;
  baseUrl: string;
  apiUrl: string;          // https://example.com/modx-elements/
  elements?: ModElementType[], // ['modSnippet', 'modChunk', ...]
  tokenKey?: string;   // stored in SecretStorage
};

export type modElement = { 
    id: number; 
    name: string; 
    content?: string; 
    type: string 
};

export type ModElementType = null | 'modChunk' | 'modSnippet' | 'modTemplate' | 'modPlugin'