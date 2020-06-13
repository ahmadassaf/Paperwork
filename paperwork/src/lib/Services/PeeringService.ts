import Peer, { DataConnection } from 'peerjs';
import { get } from 'lodash';

export interface PeerServer {
  host?: string,
  key?: string,
  port?: number,
  path?: string,
}

export interface PeeringServiceConfig {
  id?: string,
  peerServer?: PeerServer,
  handlers?: {
    onOpen?: Function,
    onConnection?: Function,
    onDisconnected?: Function,
    onClose?: Function,
    onError?: Function,
  }
}

export interface AuthorizedPeer {
  localKey: string;
  remoteKey: string;
  timestamp: Date;
}

export interface AuthorizedPeers {
  [peerId: string]: AuthorizedPeer;
}

export interface PeerConnection {
  connection: DataConnection;
}

export interface PeerConnections {
  [peerId: string]: PeerConnection;
}

export class PeeringService {
  private _config: PeeringServiceConfig;
  private _peer: Peer;
  private _id?: string;
  private _authorizedPeers: AuthorizedPeers;
  private _connections: PeerConnections;

  constructor(config: PeeringServiceConfig) {
    this._config = config;
    this._id = get(this._config, 'id', undefined);

    this._peer = new Peer(this._id, {
      'host': get(this._config, 'peerServer.host', '127.0.0.1'),
      'key': get(this._config, 'peerServer.key', 'peerjs'),
      'port': get(this._config, 'peerServer.port', 9000),
      'path': get(this._config, 'peerServer.path', '/peerjs')
    });

    this._authorizedPeers = {};
    this._connections = {};

    this._peer.on('open', (id) => {
      this._id = id;
      console.log(`My ID: ${this._id}`);

      const fn: Function|null = get(this._config, 'handlers.onOpen', null);
      if(fn !== null) {
        fn(id);
      }
    });

    this._peer.on('connection', (conn: DataConnection) => {
      console.log(`New connection:`);
      console.log(conn);

      this._handle(conn);

      this._addConnection(conn);

      const fn: Function|null = get(this._config, 'handlers.onConnection', null);
      if(fn !== null) {
        fn(conn);
      }
    });

    this._peer.on('disconnected', () => {
      console.log(`Disconnetced! Reconnecting ...`);

      const fn: Function|null = get(this._config, 'handlers.onDisconnected', null);
      if(fn !== null) {
        fn();
      }

      this._peer.reconnect();
    });

    this._peer.on('close', () => {
      console.log(`Closed!`);

      const fn: Function|null = get(this._config, 'handlers.onClose', null);
      if(fn !== null) {
        fn();
      }
    });

    this._peer.on('error', (err) => {
      console.error(err);

      const fn: Function|null = get(this._config, 'handlers.onError', null);
      if(fn !== null) {
        fn(err);
      }
    });
  }

  private _handle(conn: DataConnection): boolean {
    conn.on('data', (data: string) => {
      console.log(`Data:`);
      console.log(data);
    });

    conn.on('close', () => {
      console.log(`Closed connection!`);

      delete this._connections[conn.peer];
    });

    return true;
  }

  private _hasConnection(peerId: string): boolean {
    if(typeof this._connections[peerId] !== 'undefined'
    && this._connections[peerId] !== null
    && typeof this._connections[peerId].connection !== 'undefined'
    && this._connections[peerId].connection !== null) {
      return true;
    }

    return false;
  }

  private _addConnection(conn: DataConnection): string {
    this._connections[conn.peer] = {
      'connection': conn
    };

    return conn.peer;
  }

  public async connectAuthorizedPeers(): Promise<Array<string>> {
    let connectPromises: Array<Promise<string>> = [];

    Object.keys(this._authorizedPeers).forEach((authorizedPeerId: string) => {
      connectPromises.push(this.connect(authorizedPeerId));
    });

    return Promise.all(connectPromises);
  }

  public async connect(peerId: string): Promise<string> {
    return new Promise((fulfill, reject) => {
      if(this._hasConnection(peerId) === true) {
        return peerId;
      }

      const conn = this._peer.connect(peerId, { 'reliable': true });

      conn.on('error', (err) => {
        console.error(err);
        return reject(err);
      });

      this._handle(conn);

      conn.on('open', () => {
        console.log(`Connected:`);
        console.log(conn.peer);
        return fulfill(this._addConnection(conn));
      });
    });
  }

  public async disconnect(peerId: string): Promise<string> {
    if(this._hasConnection(peerId) === false) {
      return '';
    }

    this._connections[peerId].connection.close();

    return peerId;
  }

  public async send(peerId: string, data: any): Promise<any> {
    if(this._hasConnection(peerId) === false) {
      throw new Error(`Peer ${peerId} not connected, cannot send data!`);
    }

    return this._connections[peerId].connection.send(data);
  }

  public async sendAll(data: any): Promise<any> {
    let sendPromises: Array<Promise<any>> = [];

    Object.keys(this._connections).forEach((connectedPeerId: string) => {
      sendPromises.push(this.send(connectedPeerId, data));
    })

    return Promise.all(sendPromises);
  }
}
