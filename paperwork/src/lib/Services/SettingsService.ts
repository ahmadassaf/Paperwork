import { Storage, StorageConfig } from '../Storage';
import { PeerServer, AuthorizedPeers, AuthorizedPeer } from './PeeringService';

export class SettingsService {
  private _storageConfig: StorageConfig;
  private _storage: Storage;

  constructor() {
    this._storageConfig = {
      name: `paperwork_settings`,
      storeName: `paperwork_settings`,
      dbKey: 'paperwork',
      driverOrder: ['sqlite', 'indexeddb', 'websql', 'localstorage']
    };
    this._storage = new Storage(this._storageConfig);
  }

  private async _getSetting(settingKey: string, parse?: boolean): Promise<any> {
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

  private async _setSetting(settingKey: string, settingValue: any): Promise<string> {
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

  public async ready(): Promise<boolean> {
    const localForage = await this._storage.ready();
    return true;
  }

  public async getPeerId(): Promise<string|null> {
    return this._getSetting('peerId', false);
  }

  public async setPeerId(peerId: string): Promise<string> {
    return this._setSetting('peerId', peerId);
  }

  public async getPeerServer(): Promise<PeerServer|null> {
    return this._getSetting('peerServer', true);
  }

  public async setPeerServer(peerServer: PeerServer): Promise<string> {
    return this._setSetting('peerServer', peerServer);
  }

  public async getAuthorizedPeers(): Promise<AuthorizedPeers> {
    return this._getSetting('authorizedPeers', true);
  }

  public async setAuthorizedPeers(authorizedPeers: AuthorizedPeers): Promise<string> {
    return this._setSetting('authorizedPeers', authorizedPeers);
  }
}
