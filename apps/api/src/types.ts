export type SourceType = 'URL' | 'KEYWORD';

export interface Library {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceValue: string;
  country?: string;
  language?: string;
  notes?: string;
  tags: string;
  activeAds: number;
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Page {
  id: string;
  url: string;
  libraryId: string;
}
