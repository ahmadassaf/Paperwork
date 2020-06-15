import { SettingsService } from './Services/SettingsService';
import { PeeringService, PeeringServiceConfig, PeerServer } from './Services/PeeringService';
import { NotesService } from './Services/NotesService';

class Supervisor {
  private _settings: SettingsService;

  private _peerId: string|null;
  private _peerServer: PeerServer|null;
  private _peeringConfig: PeeringServiceConfig;
  private _peering: PeeringService|null;

  private _notes: NotesService;

  constructor() {
    this._settings = new SettingsService();

    this._peerId = null;
    this._peerServer = null;

    this._peeringConfig = {};
    this._peering = null;

    this._notes = new NotesService();
  }

  private async _peeringHandleOnOpen(id: string): Promise<boolean> {
    if(this._settings === null) {
      throw new Error('Cannot store peer ID: SettingsService not available!');
    }

    await this._settings.setPeerId(id);
    return true;
  }

  public async launch(): Promise<boolean> {
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

    await this._notes.ready();

    return true;
  }

  public async test(otherPeerId: string): Promise<void> {
    console.log('Running test ...');

    if(this._peering === null) {
      console.log('PeeringService not ready yet.');
      return;
    }

    if(this._peering.getMyPeerId() === otherPeerId) {
      console.log('I am the other peer, stopping test');
      return;
    }

    this._peering.setAuthorizedPeers({
      [otherPeerId]: {
        'localKey': 'local',
        'remoteKey': 'remote',
        'timestamp': Date.now()
      }
    });

    setTimeout(async () => {
      if(this._peering === null) {
        console.log('PeeringService not ready yet.');
        return;
      }

      try {
        const conn = await this._peering.connect(otherPeerId);
      } catch(err) {
        console.error(err);
      }
    }, 4000);
  }
}

const supervisor = new Supervisor();
export default supervisor;
