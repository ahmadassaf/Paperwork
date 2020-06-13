import { Storage, StorageConfig } from '../Storage';
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
  private _txStorageConfig: StorageConfig;
  private _txStorage: Storage;
  private _idxStorageConfig: StorageConfig;
  private _idxStorage: Storage;

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

  private _materialize(view: string, diff: string): string {
    return applyPatch(view, diff);
  }

  public async ready(): Promise<boolean> {
    const localForageTx = await this._txStorage.ready();
    console.log(localForageTx);
    const localForageIdx = await this._idxStorage.ready();
    console.log(localForageIdx);
    return true;
  }

  public async index(): Promise<Array<string>> {
    return this._idxStorage.keys();
  }

  public async indexTx(): Promise<Array<string>> {
    return this._txStorage.keys();
  }

  public async show(id: string): Promise<StorageServiceIndex> {
    if(isUuid(id) === false) {
      throw new Error('Not a valid UUID!');
    }

    const idx: StorageServiceIndex = await this._idxStorage.get(id);

    if(typeof idx !== 'object'
    || idx === null
    || idx.deletedAt !== null) {
      throw new Error('Note does not exist!');
    }

    return idx;
  }

  public async showTx(id: string): Promise<StorageServiceTransaction> {
    if(isUuid(id) === false) {
      throw new Error('Not a valid UUID!');
    }

    return this._txStorage.get(id);
  }

  public async create(data: Object): Promise<string> {
    const id: string = uuid();

    const dataStr = JSON.stringify(data, null, 2);
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

  public async createTx(staticId: string, diff: string): Promise<string> {
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

  public async update(id: string, data: Object): Promise<string> {
    const idx: StorageServiceIndex = await this.show(id);

    const dataStr = JSON.stringify(data, null, 2);
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

  public async updateTx(id: string, diff: string): Promise<string> {
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

  public async destroy(id: string): Promise<string> {
    const idx: StorageServiceIndex = await this.show(id);

    const updatedIdx: StorageServiceIndex = merge(idx, {
      'deletedAt': new Date()
    });

    await this._idxStorage.set(id, updatedIdx);
    return id;
  }

  public async destroyTx(id: string): Promise<string> {
    return id;
  }
}
