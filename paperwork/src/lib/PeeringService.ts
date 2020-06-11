import Peer, { DataConnection } from 'peerjs';
import { get } from 'lodash';

type PeeringServiceConfig = {
  peerServer?: {
    host?: string;
    key?: string;
    port?: number;
    path?: string;
  };

  handlers?: {
    onOpen?: Function;
    onConnection?: Function;
    onDisconnected?: Function;
    onClose?: Function;
    onError?: Function;
  };
};

export class PeeringService {
  _config: PeeringServiceConfig;
  _peer: Peer;
  _id: string;
  _connections: Array<DataConnection>;

  constructor(config: PeeringServiceConfig) {
    this._config = config;
    this._peer = new Peer(undefined, {
      'host': get(this._config, 'peerServer.host', 'peers.paperwork.cloud'),
      'key': get(this._config, 'peerServer.key', 'peerjs'),
      'port': get(this._config, 'peerServer.port', 9000),
      'path': get(this._config, 'peerServer.path', '/peerjs')
    });
    this._id = '';
    this._connections = [];

    this._peer.on('open', (id) => {
      this._id = id;
      console.log(`My ID: ${this._id}`);
    });

    this._peer.on('connection', (conn: DataConnection) => {
      console.log(`New connection:`);
      console.log(conn);

      this._handle(conn);

      this._connections.push(conn);
    });

    this._peer.on('disconnected', () => {
      console.log(`Disconnetced! Reconnecting ...`);
      this._peer.reconnect();
    });

    this._peer.on('close', () => {
      console.log(`Closed!`);
    });

    this._peer.on('error', (err) => {
      console.error(err);
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
