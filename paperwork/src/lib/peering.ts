import Peer, { DataConnection } from 'peerjs';

export class PeeringService {
  peer: Peer;
  id: string;
  connections: Array<DataConnection>;

  constructor() {
    this.peer = new Peer(undefined, {
      'host': '192.168.8.112',
      'key': 'peerjs',
      'port': 9000,
      'path': '/peerjs'
    });
    this.id = '';
    this.connections = [];

    this.peer.on('open', (id) => {
      this.id = id;
      console.log(`My ID: ${this.id}`);
    });

    this.peer.on('connection', (conn: DataConnection) => {
      console.log(`New connection:`);
      console.log(conn);

      this.handle(conn);

      this.connections.push(conn);
    });

    this.peer.on('disconnected', () => {
      console.log(`Disconnetced! Reconnecting ...`);
      this.peer.reconnect();
    });

    this.peer.on('close', () => {
      console.log(`Closed!`);
    });

    this.peer.on('error', (err) => {
      console.error(err);
    });
  }

  handle(conn: DataConnection): boolean {
    conn.on('data', (data: string) => {
      console.log(`Data:`);
      console.log(data);
    });

    conn.on('close', () => {
      console.log(`Closed connection!`);

      const connIdx: number = this.connections.findIndex(connection => connection == conn);

      if(connIdx > 0) {
        this.connections.splice(connIdx, 1);
      }
    });

    return true;
  }

  async connect(id: string): Promise<number> {
    return new Promise((fulfill, reject) => {
      const conn = this.peer.connect(id, { 'reliable': true });

      conn.on('error', (err) => {
        console.error(err);
        return reject(err);
      });

      this.handle(conn);

      conn.on('open', () => {
        console.log(`Connected:`);
        console.log(conn.peer);
        return fulfill((this.connections.push(conn) - 1));
      });
    });
  }

  send(connIdx: number, data: string) {
    return this.connections[connIdx].send(data);
  }

}
