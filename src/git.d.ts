import { Uri, Event } from 'vscode';

export interface InputBox {
  value: string;
}

export interface Repository {
  rootUri: Uri;
  inputBox: InputBox;
  diff(cached?: boolean): Promise<string>;
  state: {
    indexChanges: { uri: Uri }[];
  };
}

export interface API {
  repositories: Repository[];
  getRepository(uri: Uri): Repository | null;
}

export interface GitExtension {
  readonly enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;
  getAPI(version: 1): API;
}
