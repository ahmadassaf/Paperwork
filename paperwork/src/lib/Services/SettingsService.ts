import { Storage, StorageConfig } from '../Storage';
import { PeerServer } from './PeeringService';

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

  async _getSetting(settingKey: string, parse?: boolean): Promise<any> {
    const settingValue: string = await this._storage.get(settingKey);

    if(typeof settingValue !== 'string'
    || settingValue === null
    || settingValue.length <= 0) {
      return null;
    }

    if(parse === true) {
      return JSON.parse(settingValue);
    }

    return settingValue;
  }

  async _setSetting(settingKey: string, settingValue: any): Promise<string> {
    let validatedSettingValue: any = settingValue;

    if(typeof settingValue === 'undefined'
    || settingValue === null) {
      return '';
    }

    if(typeof settingValue !== 'string') {
      validatedSettingValue = JSON.stringify(settingValue);
    }

    await this._storage.set(settingKey, validatedSettingValue);
    return settingKey;
  }

  async ready(): Promise<boolean> {
    const localForage = await this._storage.ready();
    return true;
  }

  async getPeerId(): Promise<string|null> {
    return this._getSetting('peerId', false);
  }

  async setPeerId(peerId: string): Promise<string> {
    return this._setSetting('peerId', peerId);
  }

  async getPeerServer(): Promise<PeerServer|null> {
    return this._getSetting('peerServer', true);
  }

  async setPeerServer(peerServer: PeerServer): Promise<string> {
    return this._setSetting('peerServer', peerServer);
  }
}
