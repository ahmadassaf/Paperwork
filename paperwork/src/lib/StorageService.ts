import { Storage, StorageConfig } from './Storage';
import { uuid, isUuid } from 'uuidv4';
import { createTwoFilesPatch } from 'diff';
import { get, merge } from 'lodash';

enum StorageServiceTransactionTypes {
  Create = 'create',
  Update = 'update',
  Destroy = 'destroy'
}

export interface StorageServiceTransaction {
  type: StorageServiceTransactionTypes,
  staticId: string,
  data: string,
  diff: string,
  revisesId: string|null,
  timestamp: Date,
}

export interface StorageServiceMaterializedView {
  [key: string]: string|number|boolean|Object
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
  _materializedView: StorageServiceMaterializedView

  constructor(dbName: string, materializedView: StorageServiceMaterializedView) {
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

    this._materializedView = materializedView;
  }

  _materialize(data: Object): StorageServiceMaterializedView {
    let materializedView: StorageServiceMaterializedView = {};

    Object.keys(this._materializedView).forEach((path, key) => {
      materializedView[key] = get(data, path);
    });

    return materializedView;
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

    const txId: string = await this.createTx(id, data);

    const idx: StorageServiceIndex = {
      'latestTxId': txId,
      'createdAt': new Date(),
      'updatedAt': new Date(),
      'deletedAt': null,
      'materializedView': JSON.stringify(this._materialize(data))
    }

    await this._idxStorage.set(id, idx);
    return id;
  }

  async createTx(staticId: string, data: Object): Promise<string> {
    const id: string = uuid();
    const dataStr = JSON.stringify(data);

    const diff = createTwoFilesPatch('', id, '', dataStr);

    const transaction: StorageServiceTransaction = {
      'type': StorageServiceTransactionTypes.Create,
      'staticId': staticId,
      'data': dataStr,
      'diff': diff,
      'revisesId': null,
      'timestamp': new Date()
    };

    await this._txStorage.set(id, transaction);
    return id;
  }

  async update(id: string, data: Object): Promise<string> {
    const idx: StorageServiceIndex = await this.show(id);
    const txId: string = await this.updateTx(idx.latestTxId, data);

    const updatedIdx: StorageServiceIndex = {
      'latestTxId': txId,
      'materializedView': JSON.stringify(this._materialize(data)),
      'createdAt': idx.createdAt,
      'updatedAt': new Date(),
      'deletedAt': null
    }

    await this._idxStorage.set(id, updatedIdx);
    return id;
  }

  async updateTx(id: string, data: Object): Promise<string> {
    const existingEntry: StorageServiceTransaction = await this.showTx(id);
    const revisionId: string = uuid();
    const dataStr = JSON.stringify(data);

    const diff = createTwoFilesPatch(id, revisionId, existingEntry.data, dataStr);

    const transaction: StorageServiceTransaction = {
      'type': StorageServiceTransactionTypes.Update,
      'staticId': existingEntry.staticId,
      'data': dataStr,
      'diff': diff,
      'revisesId': id,
      'timestamp': new Date()
    };

    await this._txStorage.set(revisionId, transaction);
    return revisionId;
  }

  async destroy(id: string): Promise<string> {
    const idx: StorageServiceIndex = await this.show(id);
    const txId: string = await this.updateTx(idx.latestTxId, data);

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
