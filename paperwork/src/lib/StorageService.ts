import { Storage, StorageConfig } from './Storage';
import { uuid, isUuid } from 'uuidv4';
import { createPatch, applyPatch } from 'diff';
import { get, merge } from 'lodash';

enum StorageServiceTransactionTypes {
  Create = 'create',
  Update = 'update',
  Destroy = 'destroy'
}

export interface StorageServiceTransaction {
  type: StorageServiceTransactionTypes,
  staticId: string,
  diff: string,
  revisesId: string|null,
  timestamp: Date,
}

export interface StorageServiceIndex {
  latestTxId: string,
  materializedView: string
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date|null
}

export class StorageService {
  _txStorageConfig: StorageConfig;
  _txStorage: Storage;
  _idxStorageConfig: StorageConfig;
  _idxStorage: Storage;

  constructor(dbName: string) {
    this._txStorageConfig = {
      name: `paperwork_tx_${dbName}`,
      storeName: `paperwork_tx_${dbName}`,
      dbKey: 'paperwork',
      driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
    };
    this._txStorage = new Storage(this._txStorageConfig);

    this._idxStorageConfig = {
      name: `paperwork_idx_${dbName}`,
      storeName: `paperwork_idx_${dbName}`,
      dbKey: 'paperwork',
      driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
    };
    this._idxStorage = new Storage(this._idxStorageConfig);
  }

  _materialize(view: string, diff: string): string {
    return applyPatch(view, diff);
  }

  async ready(): Promise<boolean> {
    const localForageTx = await this._txStorage.ready();
    console.log(localForageTx);
    const localForageIdx = await this._idxStorage.ready();
    console.log(localForageIdx);
    return true;
  }

  async index(): Promise<Array<string>> {
    return this._idxStorage.keys();
  }

  async indexTx(): Promise<Array<string>> {
    return this._txStorage.keys();
  }

  async show(id: string): Promise<StorageServiceIndex> {
    if(isUuid(id) === false) {
      throw new Error('Not a valid UUID!');
    }

    return this._idxStorage.get(id);
  }

  async showTx(id: string): Promise<StorageServiceTransaction> {
    if(isUuid(id) === false) {
      throw new Error('Not a valid UUID!');
    }

    return this._txStorage.get(id);
  }

  async create(data: Object): Promise<string> {
    const id: string = uuid();

    const dataStr = JSON.stringify(data);
    const diff = createPatch(id, '', dataStr);

    const txId: string = await this.createTx(id, diff);

    const idx: StorageServiceIndex = {
      'latestTxId': txId,
      'createdAt': new Date(),
      'updatedAt': new Date(),
      'deletedAt': null,
      'materializedView': this._materialize('', diff)
    }

    await this._idxStorage.set(id, idx);
    return id;
  }

  async createTx(staticId: string, diff: string): Promise<string> {
    const id: string = uuid();

    const transaction: StorageServiceTransaction = {
      'type': StorageServiceTransactionTypes.Create,
      'staticId': staticId,
      'diff': diff,
      'revisesId': null,
      'timestamp': new Date()
    };

    await this._txStorage.set(id, transaction);
    return id;
  }

  async update(id: string, data: Object): Promise<string> {
    const idx: StorageServiceIndex = await this.show(id);

    const dataStr = JSON.stringify(data);
    const diff = createPatch(id, idx.materializedView, dataStr);

    const txId: string = await this.updateTx(idx.latestTxId, diff);

    const updatedIdx: StorageServiceIndex = {
      'latestTxId': txId,
      'materializedView': this._materialize(idx.materializedView, diff),
      'createdAt': idx.createdAt,
      'updatedAt': new Date(),
      'deletedAt': null
    }

    await this._idxStorage.set(id, updatedIdx);
    return id;
  }

  async updateTx(id: string, diff: string): Promise<string> {
    const existingEntry: StorageServiceTransaction = await this.showTx(id);
    const revisionId: string = uuid();

    const transaction: StorageServiceTransaction = {
      'type': StorageServiceTransactionTypes.Update,
      'staticId': existingEntry.staticId,
      'diff': diff,
      'revisesId': id,
      'timestamp': new Date()
    };

    await this._txStorage.set(revisionId, transaction);
    return revisionId;
  }

  async destroy(id: string): Promise<string> {
    const idx: StorageServiceIndex = await this.show(id);

    const updatedIdx: StorageServiceIndex = merge(idx, {
      'deletedAt': new Date()
    });

    await this._idxStorage.set(id, updatedIdx);
    return id;
  }

  async destroyTx(id: string): Promise<string> {
    return id;
  }
}
