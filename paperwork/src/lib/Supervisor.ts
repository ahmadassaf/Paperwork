import { SettingsService } from './Services/SettingsService';
import { PeeringService, PeeringServiceConfig, PeerServer } from './Services/PeeringService';
import { NotesService } from './Services/NotesService';

class Supervisor {
  private _settings: SettingsService|null;
  private _peerId: string|null;
  private _peerServer: PeerServer|null;
  private _peeringConfig: PeeringServiceConfig;
  private _peering: PeeringService|null;

  constructor() {
    this._settings = null;

    this._peerId = null;
    this._peerServer = null;

    this._peeringConfig = {};
    this._peering = null;
  }

  private async _peeringHandleOnOpen(id: string): Promise<boolean> {
    if(this._settings === null) {
      throw new Error('Cannot store peer ID: SettingsService not available!');
    }

    await this._settings.setPeerId(id);
    return true;
  }

  public async launch() {
    this._settings = new SettingsService();
    await this._settings.ready();

    this._peerId = await this._settings.getPeerId();
    this._peerServer = await this._settings.getPeerServer();

    if(this._peerId !== null) {
      this._peeringConfig.id = this._peerId;
    }

    if(this._peerServer !== null) {
      this._peeringConfig.peerServer = this._peerServer;
    }

    this._peeringConfig.handlers = {
      'onOpen': (id: string) => {
        return this._peeringHandleOnOpen(id);
      }
    }

    this._peering = new PeeringService(this._peeringConfig);
  }
}
