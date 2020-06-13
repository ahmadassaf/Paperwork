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

export class PeeringService {
  _config: PeeringServiceConfig;
  _peer: Peer;
  _id?: string;
  _connections: Array<DataConnection>;

  constructor(config: PeeringServiceConfig) {
    this._config = config;
    this._id = get(this._config, 'id', undefined);

    this._peer = new Peer(this._id, {
      'host': get(this._config, 'peerServer.host', 'peers.paperwork.cloud'),
      'key': get(this._config, 'peerServer.key', 'peerjs'),
      'port': get(this._config, 'peerServer.port', 9000),
      'path': get(this._config, 'peerServer.path', '/peerjs')
    });
    this._connections = [];

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

      this._connections.push(conn);

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

  _handle(conn: DataConnection): boolean {
    conn.on('data', (data: string) => {
      console.log(`Data:`);
      console.log(data);
    });

    conn.on('close', () => {
      console.log(`Closed connection!`);

      const connIdx: number = this._connections.findIndex(connection => connection === conn);

      if(connIdx > 0) {
        this._connections.splice(connIdx, 1);
      }
    });

    return true;
  }

  async connect(id: string): Promise<number> {
    return new Promise((fulfill, reject) => {
      const conn = this._peer.connect(id, { 'reliable': true });

      conn.on('error', (err) => {
        console.error(err);
        return reject(err);
      });

      this._handle(conn);

      conn.on('open', () => {
        console.log(`Connected:`);
        console.log(conn.peer);
        return fulfill((this._connections.push(conn) - 1));
      });
    });
  }

  send(connIdx: number, data: string) {
    return this._connections[connIdx].send(data);
  }

}
