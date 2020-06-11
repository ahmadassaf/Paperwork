import { Storage, StorageConfig, getDefaultConfig } from './Storage';
import { uuid, isUuid } from 'uuidv4';
import Diff from 'diff';

enum StorageServiceEntryTypes {
  Create = 'create',
  Update = 'update',
  Destroy = 'destroy'
}

export interface StorageServiceEntry {
  type: StorageServiceEntryTypes,
  staticId: string,
  data: string,
  diff: string,
  revisesId: string|null,
  timestamp: Date,
}

export class StorageService {
  _storageConfig: StorageConfig;
  _storage: Storage;

  constructor(dbName: string) {
    this._storageConfig = {
      name: `paperwork_${dbName}`,
      storeName: `paperwork_${dbName}`,
      dbKey: 'paperwork',
      driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
    };
    this._storage = new Storage(this._storageConfig);
  }

  async ready(): Promise<boolean> {
    const localForage = await this._storage.ready();
    return true;
  }

  async indexEntryById(): Promise<Array<string>> {
    return this._storage.keys();
  }

  async showEntryById(id: string): Promise<StorageServiceEntry> {
    if(isUuid(id) === false) {
      throw new Error('Not a valid UUID!');
    }

    return this._storage.get(id);
  }

  async createEntryById(data: string): Promise<string> {
    const id: string = uuid();
    const staticId: string = uuid();

    const diff = Diff.createTwoFilesPatch('', id, '', data);

    const entry: StorageServiceEntry = {
      'type': StorageServiceEntryTypes.Create,
      'staticId': staticId,
      'data': data,
      'diff': diff,
      'revisesId': null,
      'timestamp': new Date()
    };

    await this._storage.set(id, entry);
    return id;
  }

  async updateEntryById(id: string, data: string): Promise<string> {
    const existingEntry: StorageServiceEntry = await this.showEntryById(id);
    const revisionId: string = uuid();

    const diff = Diff.createTwoFilesPatch(id, revisionId, existingEntry.data, data);

    const entry: StorageServiceEntry = {
      'type': StorageServiceEntryTypes.Update,
      'staticId': existingEntry.staticId,
      'data': data,
      'diff': diff,
      'revisesId': id,
      'timestamp': new Date()
    };

    await this._storage.set(revisionId, entry);
    return revisionId;
  }

  async destroyEntryById(id: string): Promise<string> {
    const existingEntry: StorageServiceEntry = await this.showEntryById(id);
    const revisionId: string = uuid();

    const diff = Diff.createTwoFilesPatch(id, revisionId, existingEntry.data, '');

    const entry: StorageServiceEntry = {
      'type': StorageServiceEntryTypes.Destroy,
      'staticId': existingEntry.staticId,
      'data': '',
      'diff': diff,
      'revisesId': id,
      'timestamp': new Date()
    };

    await this._storage.set(revisionId, entry);
    return revisionId;
  }
}
