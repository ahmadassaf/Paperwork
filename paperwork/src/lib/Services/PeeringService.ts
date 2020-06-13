import Peer, { DataConnection } from 'peerjs';
import { get, difference, merge, delay } from 'lodash';
import { OK, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN } from 'http-status-codes';
import { uuid } from 'uuidv4';

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
  timestamp: number;
}

export interface AuthorizedPeers {
  [peerId: string]: AuthorizedPeer;
}

export interface PeerConnection {
  connection: DataConnection;
  authed: boolean;
}

export interface PeerConnections {
  [peerId: string]: PeerConnection;
}

export enum PeerDataCommands {
  Status = 0,
  Auth,
  AuthOk,
  Sync
}

export interface PeerData {
  id: string;
  command: PeerDataCommands;
  code: number;
  timestamp: number;
  payload?: any;
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

    console.log(`Initializing PeeringService with peer ID ${this._id} ...`);
    this._peer = new Peer(this._id, {
      'host': get(this._config, 'peerServer.host', '127.0.0.1'),
      'key': get(this._config, 'peerServer.key', 'peerjs'),
      'port': get(this._config, 'peerServer.port', 9000),
      'path': get(this._config, 'peerServer.path', '/peerjs')
    });

    this._authorizedPeers = {};
    this._connections = {};

    /**
     * Emitted when a connection to the PeerServer is established.
     */
    this._peer.on('open', (id) => {
      console.info(`PeeringService connected to the peer server and will accept new connections at its own ID '${id}' now!`);

      this._id = id;

      const fn: Function|null = get(this._config, 'handlers.onOpen', null);
      if(fn !== null) {
        fn(id);
      }
    });

    /**
     * Emitted when a new data connection is established from a remote peer.
     */
    this._peer.on('connection', (conn: DataConnection) => {
      const peerId: string = conn.peer;
      console.log(`PeeringService received a new connection from peer ID: ${peerId}`);

      if(this._authorizedPeers.hasOwnProperty(peerId) === false) {
        console.error(`Peer ID ${peerId} not allowed to connect! Disconnecting ...`);
        delay(() => this.send(conn, this.craftForbidden()), 0);
        delay(() => conn.close(), 1000);
        return;
      }

      this._addConnection(conn);
      this._handleConnection(conn);

      const fn: Function|null = get(this._config, 'handlers.onConnection', null);
      if(fn !== null) {
        fn(conn);
      }
    });

    /**
     * Emitted when the peer is disconnected from the signalling server, either
     * manually or because the connection to the signalling server was lost.
     */
    this._peer.on('disconnected', () => {
      console.info(`PeeringService got disconnected from the peer server! Reconnecting ...`);
      this._peer.reconnect();

      const fn: Function|null = get(this._config, 'handlers.onDisconnected', null);
      if(fn !== null) {
        fn();
      }
    });

    /**
     * Emitted when the peer is destroyed and can no longer accept or create any
     * new connections.
     */
    this._peer.on('close', () => {
      console.warn(`PeeringService was destroyed and won't accept any new connections`);

      const fn: Function|null = get(this._config, 'handlers.onClose', null);
      if(fn !== null) {
        fn();
      }
    });

    /**
     * Errors on the peer are almost always fatal and will destroy the peer.
     * Errors from the underlying socket and PeerConnections are forwarded here.
     */
    this._peer.on('error', (err) => {
      console.error(`PeeringService failed badly and won't accept any new connections:`);
      console.error(err);

      const fn: Function|null = get(this._config, 'handlers.onError', null);
      if(fn !== null) {
        fn(err);
      }
    });
  }

  private _processData(peerId: string, data: PeerData): boolean {
    const peerConnection: PeerConnection|null = this._getPeerConnectionById(peerId);

    if(peerConnection === null) {
      console.warn(`Received data from ${peerId} but peer seems to have disconnected before it was processed: ${JSON.stringify(data)}`);
      return false;
    }

    if(peerConnection.authed === false) {
      switch(data.command) {
        case PeerDataCommands.Auth:
          this._processAuth(peerConnection, peerId, data);
          break;
        case PeerDataCommands.AuthOk:
          this._processAuth(peerConnection, peerId, data);
          break;
        default:
          this.send(peerId, this.craftUnauthorized());
          break;
      }
    } else {
      switch(data.command) {
        case PeerDataCommands.Sync:
          // TODO: Perform sync
          break;
        default:
          this.send(peerId, this.craftBadRequest(data));
          break;
      }
    }

    return true;
  }

  private _processAuth(peerConnection: PeerConnection, peerId: string, data: PeerData): boolean {
    const authorizedPeer: AuthorizedPeer|null = this.getAuthorizedPeerById(peerId);

    if(authorizedPeer === null) {
      console.warn(`Received Auth request from peer ${peerId} which is not (anymore?) in the authorized peers list. Disconnecting ...`);
      this.send(peerId, this.craftForbidden());
      this.disconnect(peerId);
      return false;
    }

    const authLocalKey: string = get(data, 'payload.yourKey', '');
    const authRemoteKey: string = get(data, 'payload.myKey', '');
    if(authorizedPeer.localKey === authLocalKey) {
      console.log(`Auth of peer ${peerId} was successful!`);
      authorizedPeer.remoteKey = authRemoteKey;
      // TODO: Emit update to authoriedPeers so it can be persisted
      peerConnection.authed = true;
      this.send(peerId, this.craftAuthOk());
      return true;
    }

    return true;
  }

  private _processAuthOk(peerConnection: PeerConnection, peerId: string, data: PeerData): boolean {
    const authorizedPeer: AuthorizedPeer|null = this.getAuthorizedPeerById(peerId);

    if(authorizedPeer === null) {
      console.warn(`Received AuthOk response from peer ${peerId} which is not (anymore?) in the authorized peers list. Disconnecting ...`);
      this.send(peerId, this.craftForbidden());
      this.disconnect(peerId);
      return false;
    }

    peerConnection.authed = true;
    return true;
  }

  private _handleConnection(conn: DataConnection, connectFulfillment?: Function, connectRejection?: Function): boolean {
    // 'open' is only for outgoing connections that were initialized through
    // connect()
    conn.on('open', async () => {
      const peerId: string = conn.peer;
      console.debug(`Connected to peer ${peerId}!`);

      const connectedPeerId: string = this._addConnection(conn);
      const authorizedPeer: AuthorizedPeer|null = this.getAuthorizedPeerById(connectedPeerId);

      if(authorizedPeer === null) {
        console.warn(`Connected to peer ${peerId} which is not (anymore?) in the authorized peers list. Disconnecting ...`);
        this.send(peerId, this.craftForbidden());
        this.disconnect(peerId);
        return false;
      }

      try {
        await this.send(connectedPeerId, this.craftAuth(authorizedPeer.localKey, authorizedPeer.remoteKey));

        if(typeof connectFulfillment !== 'undefined') {
          return connectFulfillment(connectedPeerId);
        }
      } catch(err) {
        console.error(err);
        if(typeof connectRejection !== 'undefined') {
          return connectRejection(err);
        }
      }
    });

    conn.on('data', (data: PeerData) => {
      console.debug(`Data:`);
      console.debug(data);
      this._processData(conn.peer, data);
    });

    conn.on('close', () => {
      const peerId: string = conn.peer;
      console.debug(`Closed connection to peer ${peerId}!`);
      this._removeConnection(conn);
    });

    conn.on('error', (err) => {
      console.error(err);
      this._removeConnection(conn);
      if(typeof connectRejection !== 'undefined') {
        return connectRejection(err);
      }
    });

    return true;
  }

  private _hasConnectionById(peerId: string): boolean {
    if(typeof this._connections[peerId] !== 'undefined'
    && this._connections[peerId] !== null
    && typeof this._connections[peerId].connection !== 'undefined'
    && this._connections[peerId].connection !== null) {
      return true;
    }

    return false;
  }

  private _hasConnection(conn: DataConnection): boolean {
    const peerId: string = conn.peer;
    return this._hasConnectionById(peerId);
  }

  private _getConnectionById(peerId: string): DataConnection|null {
    if(this._hasConnectionById(peerId) === false) {
      return null;
    }

    return this._connections[peerId].connection;
  }

  private _getPeerConnectionById(peerId: string): PeerConnection|null {
    if(this._hasConnectionById(peerId) === false) {
      return null;
    }

    return this._connections[peerId];
  }

  private _addConnection(conn: DataConnection): string {
    const peerId: string = conn.peer;

    this._connections[peerId] = {
      'connection': conn,
      'authed': false
    };

    return peerId;
  }

  private _removeConnectionById(peerId: string): string {
    if(this._hasConnectionById(peerId) === false) {
      return '';
    }

    this._connections[peerId].connection.close();
    delete this._connections[peerId];

    return peerId;
  }

  private _removeConnection(conn: DataConnection): string {
    if(this._hasConnection(conn) === false) {
      return '';
    }

    const peerId: string = conn.peer;

    if(typeof this._connections[peerId].connection !== 'undefined'
    && this._connections[peerId].connection !== null
    && typeof this._connections[peerId].connection.close !== 'undefined') {
      this._connections[peerId].connection.close();
    }

    delete this._connections[peerId];
    return peerId;
  }

  public getMyPeerId(): string {
    if(typeof this._id === 'string') {
      return this._id;
    }

    return '';
  }

  public setAuthorizedPeers(authorizedPeers: AuthorizedPeers): boolean {
    this._authorizedPeers = authorizedPeers;
    return true;
  }

  public getAuthorizedPeers(): AuthorizedPeers {
    return this._authorizedPeers;
  }

  public isAuthorizedPeerById(peerId: string): boolean {
    if(this._authorizedPeers.hasOwnProperty(peerId) === true
    && this._authorizedPeers[peerId] !== null) {
      return true;
    }

    return false;
  }

  public getAuthorizedPeerById(peerId: string): AuthorizedPeer|null {
    if(this.isAuthorizedPeerById(peerId) === false) {
      return null;
    }

    return this._authorizedPeers[peerId];
  }

  public async syncAuthorizedPeersAndConnections(removeConnections: boolean, makeConnections: boolean): Promise<Array<Array<string>>> {
    let removeConnectionsPromises: Array<Promise<string>> = [];
    let makeConnectionsPromises: Array<Promise<string>> = [];

    if(removeConnections === true
    || makeConnections === true) {
      const connectedPeerIds: Array<string> = Object.keys(this._connections);
      const authorizedPeerIds: Array<string> = Object.keys(this._authorizedPeers);

      if(removeConnections === true) {
        const connectionsToRemove: Array<string> = difference(connectedPeerIds, authorizedPeerIds);
        connectionsToRemove.forEach((peerId: string) => {
          removeConnectionsPromises.push(this.disconnect(peerId));
        });
      }

      if(makeConnections === true) {
        const connectionsToMake: Array<string> = difference(authorizedPeerIds, connectedPeerIds);
        connectionsToMake.forEach((peerId: string) => {
          makeConnectionsPromises.push(this.connect(peerId));
        });
      }

      return [
        await Promise.all(removeConnectionsPromises),
        await Promise.all(makeConnectionsPromises)
      ];
    }

    return [];
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
      console.debug(`Trying to connect to peer ${peerId} ...`);
      if(this._hasConnectionById(peerId) === true) {
        console.debug(`Peer ${peerId} is already connected!`);
        return peerId;
      }

      const authorizedPeer: AuthorizedPeer|null = this.getAuthorizedPeerById(peerId);
      if(authorizedPeer === null) {
        throw new Error(`Cannot connecto to peer ${peerId} as it is not within the authorized peers list!`);
      }

      const conn = this._peer.connect(peerId, { 'reliable': true });
      this._handleConnection(conn, fulfill, reject);
    });
  }

  public async disconnect(peerId: string): Promise<string> {
    if(this._hasConnectionById(peerId) === false) {
      return '';
    }

    this._removeConnectionById(peerId);

    return peerId;
  }

  public async send(peerId: string, data: PeerData): Promise<any>;
  public async send(conn: DataConnection, data: PeerData): Promise<any>;
  public async send(peerIdOrConn: string|DataConnection, data: PeerData): Promise<any> {
    if(typeof peerIdOrConn === 'string') {
      if(this._hasConnectionById(peerIdOrConn) === false) {
        throw new Error(`Peer ${peerIdOrConn} not connected, cannot send data!`);
      }
      console.debug(`Sending data to ${peerIdOrConn}: ${JSON.stringify(data)}`);
      return this._connections[peerIdOrConn].connection.send(data);
    } else {
      console.debug(`Sending data to ${peerIdOrConn.peer}: ${JSON.stringify(data)}`);
      return peerIdOrConn.send(data);
    }
  }

  public async sendAll(data: PeerData): Promise<any> {
    let sendPromises: Array<Promise<any>> = [];

    Object.keys(this._connections).forEach((connectedPeerId: string) => {
      sendPromises.push(this.send(connectedPeerId, data));
    })

    return Promise.all(sendPromises);
  }

  public craftSkeleton(): PeerData {
    return {
      'id': uuid(),
      'command': -1,
      'timestamp': Date.now(),
      'code': -1
    };
  }

  public craftAuth(localKey: string, remoteKey: string): PeerData {
    return merge(this.craftSkeleton(), {
      'command': PeerDataCommands.Auth,
      'code': OK,
      'payload': {
        'myKey': localKey,
        'yourKey': remoteKey
      }
    });
  }

  public craftAuthOk(): PeerData {
    return merge(this.craftSkeleton(), {
      'command': PeerDataCommands.AuthOk,
      'code': OK
    });
  }

  public craftBadRequest(payload: any): PeerData {
    return merge(this.craftSkeleton(), {
      'command': PeerDataCommands.Status,
      'code': BAD_REQUEST,
      'payload': payload
    });
  }

  public craftUnauthorized(): PeerData {
    return merge(this.craftSkeleton(), {
      'command': PeerDataCommands.Status,
      'code': UNAUTHORIZED
    });
  }

  public craftForbidden(): PeerData {
    return merge(this.craftSkeleton(), {
      'command': PeerDataCommands.Status,
      'code': FORBIDDEN
    });
  }
}
