import React from 'react';
import { StorageService, StorageServiceIndex } from './StorageService';

export interface Note {
  id: string,
  title: string,
  content: string,
  tags: Array<string>,
  attachments: Array<string>,
  meta: {
    [key: string]: string|number|boolean|Object
  }
}

export class NotesService {
  private _storageService: StorageService;

  constructor() {
    this._storageService = new StorageService('notes');
  }

  public async ready() {
    return this._storageService.ready();
  }

  public async index(resolve?: boolean): Promise<Array<string>|Array<Note>> {
    const idxIds: Array<string> = await this._storageService.index();

    if(resolve !== true) {
      return idxIds;
    }

    let resolverPromises: Array<Promise<Note>> = [];
    idxIds.forEach((idxId: string) => {
      resolverPromises.push(this.show(idxId));
    });

    return Promise.all(resolverPromises);
  }

  public async show(id: string): Promise<Note> {
    const idx: StorageServiceIndex = await this._storageService.show(id);
    return JSON.parse(idx.materializedView);
  }

  public async create(data: Object): Promise<string> {
    return this._storageService.create(data);
  }

  public async update(id: string, data: Object): Promise<string> {
    return this._storageService.update(id, data);
  }

  public async destroy(id: string): Promise<string> {
    return this._storageService.destroy(id);
  }
}
