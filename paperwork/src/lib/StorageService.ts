import Diff from 'diff';
import { Storage, StorageConfig, getDefaultConfig } from './Storage';

export class StorageService {
  _storageConfig: StorageConfig;
  _storage: Storage;

  constructor() {
    this._storageConfig = getDefaultConfig();
    this._storage = new Storage(this._storageConfig);
  }


}
