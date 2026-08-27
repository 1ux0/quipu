export interface Note {
  path: string;
  name: string;
  title: string;
  modified: number;
  created: number;
}

export interface Folder {
  path: string;
  name: string;
  created: number;
}
