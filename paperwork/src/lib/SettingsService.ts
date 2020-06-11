import { Storage, StorageConfig } from './Storage';

export class SettingsService {
  _storageConfig: StorageConfig;
  _storage: Storage;

  constructor() {
    this._storageConfig = {
      name: `paperwork_settings`,
      storeName: `paperwork_settings`,
      dbKey: 'paperwork',
      driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
    };
    this._storage = new Storage(this._storageConfig);
  }

  async ready(): Promise<boolean> {
    const localForage = await this._storage.ready();
    return true;
  }

  async getPeerId(): Promise<string|null> {
    const peerId: string = await this._storage.get('peerId');

    if(typeof peerId !== 'string'
    || peerId === null
    || peerId.length <= 0) {
      return null;
    }

    return peerId;
  }

  async setPeerId(peerId: string): Promise<string> {
    await this._storage.set('peerId', peerId);
    return peerId;
  }
}
