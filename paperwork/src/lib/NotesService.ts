import React from 'react';
import { StorageService } from './StorageService';

export class NotesService {
  _storageService: StorageService;

  constructor() {
    this._storageService = new StorageService('notes');
  }

  ready() {
    return this._storageService.ready();
  }

  index() {
    return this._storageService.index();
  }

  create(data: string) {
    return this._storageService.create(data, {});
  }
}
