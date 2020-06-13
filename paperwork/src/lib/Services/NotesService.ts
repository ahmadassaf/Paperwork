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
  _storageService: StorageService;

  constructor() {
    this._storageService = new StorageService('notes');
  }

  async ready() {
    return this._storageService.ready();
  }

  async index(resolve?: boolean): Promise<Array<string>|Array<Note>> {
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

  async show(id: string): Promise<Note> {
    const idx: StorageServiceIndex = await this._storageService.show(id);
    return JSON.parse(idx.materializedView);
  }

  async create(data: Object): Promise<string> {
    return this._storageService.create(data);
  }

  async update(id: string, data: Object): Promise<string> {
    return this._storageService.update(id, data);
  }

  async destroy(id: string): Promise<string> {
    return this._storageService.destroy(id);
  }
}
