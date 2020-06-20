import { difference, intersection, omit, last } from 'lodash';
import { StorageServiceIndex, StorageServiceTransaction } from './StorageService';

export interface SyncComparison {
  inRemoteNotInLocal: Array<string>;
  inLocalNotInRemote: Array<string>;
  inBoth: Array<string>;
}

export interface SyncAction {
  need: Array<string>;
  have: Array<StorageServiceIndex>;
  check: Array<Partial<StorageServiceIndex>>;
}



export class SyncService {
  constructor() {
  }

  public getComparison(localIds: Array<string>, remoteIds: Array<string>): SyncComparison {
    const inRemoteNotInLocal: Array<string> = difference(remoteIds, localIds);
    const inLocalNotInRemote: Array<string> = difference(localIds, remoteIds);
    const inBoth: Array<string> = intersection(localIds, remoteIds);

    return {
      'inRemoteNotInLocal': inRemoteNotInLocal,
      'inLocalNotInRemote': inLocalNotInRemote,
      'inBoth': inBoth
    };
  }

  public getActionFromComparison(comparison: SyncComparison, localEntries: Array<StorageServiceIndex>): SyncAction {
    const need: Array<string> = comparison.inRemoteNotInLocal;
    const have: Array<StorageServiceIndex> =
      comparison.inLocalNotInRemote.map((localId: string): StorageServiceIndex => {
        const foundEntry: StorageServiceIndex|undefined = localEntries.find((localEntry: StorageServiceIndex) => localEntry.id === localId);
        if(typeof foundEntry === 'undefined') {
          throw new Error(`Entry with ID ${localId} not found in local entries!`);
        }
        return foundEntry;
      });
    const check: Array<Partial<StorageServiceIndex>> =
      comparison.inBoth.map((localId: string): Partial<StorageServiceIndex> => {
        const foundEntry: StorageServiceIndex|undefined = localEntries.find((localEntry: StorageServiceIndex) => localEntry.id === localId);
        if(typeof foundEntry === 'undefined') {
          throw new Error(`Entry with ID ${localId} not found in local entries!`);
        }
        return omit(foundEntry, ['materializedView']);
      });
    return {
      'need': need,
      'have': have,
      'check': check
    };
  }

  public getOutOfSyncEntries(checkEntries: Array<Partial<StorageServiceIndex>>, localEntries: Array<StorageServiceIndex>): Array<string> {
    return checkEntries.filter(
      (checkEntry: Partial<StorageServiceIndex>): boolean => {
        const foundEntry: StorageServiceIndex|undefined = localEntries.find(
          (localEntry: StorageServiceIndex): boolean =>
            localEntry.id === checkEntry.id);
        if(typeof foundEntry === 'undefined'
        || foundEntry.latestTxId !== checkEntry.latestTxId) {
          return true;
        }

        return false;
      }
    ).map(
      (filteredEntry: Partial<StorageServiceIndex>): string =>
        filteredEntry.id || 'NO_ID_AVAILABLE'
    );
  }

  public async mergeTxChains(localChain: Array<StorageServiceTransaction>, remoteChain: Array<StorageServiceTransaction>, merger: Function): Promise<Array<StorageServiceTransaction>> {
    const localLastLink: StorageServiceTransaction|undefined = last(localChain);
    const remoteLastLink: StorageServiceTransaction|undefined = last(remoteChain);

    if(typeof localLastLink === 'undefined') {
      console.debug(`Local chain has no links yet, picking remote.`);
      return remoteChain;
    } else if(typeof remoteLastLink === 'undefined') {
      console.debug(`Remote chain has no links yet, picking local.`);
      return localChain;
    }

    if(localLastLink.id === remoteLastLink.id
    && localChain.length === remoteChain.length) {
      console.debug(`Both chains end up with the same link and are of identical length. Picking either.`);
      return localChain;
    }

    if(localLastLink.id === remoteLastLink.id
    && localChain.length !== remoteChain.length) {
      console.debug(`Both chains end up with the same link, however their length is different. Something is terribly weird here. Picking the longer one.`);
      if(localChain.length > remoteChain.length) {
        return localChain;
      } else {
        return remoteChain;
      }
    }

    const [localLastLinkTimestamp, localLastLinkUuid] = localLastLink.id.split(':');
    const [remoteLastLinkTimestamp, remoteLastLinkUuid] = remoteLastLink.id.split(':');

    // Check if local is newer than remote
    let localIsNewer: boolean = false;
    if(parseInt(localLastLinkTimestamp, 10) > parseInt(remoteLastLinkTimestamp, 10)) {
      localIsNewer = true;
    }

    let newerChain: Array<StorageServiceTransaction> = localChain;
    let newerLastLink: StorageServiceTransaction = localLastLink;
    let olderChain: Array<StorageServiceTransaction> = remoteChain;
    let olderLastLink: StorageServiceTransaction = remoteLastLink;
    if(localIsNewer) {
      console.debug(`Last local chain link is newer than last remote chain link.`);
      newerChain = remoteChain;
      newerLastLink = remoteLastLink;
      olderChain = localChain;
      olderLastLink = localLastLink;
    } else {
      console.debug(`Last remote chain link is newer than last local chain link.`);
    }

    const commonLink: StorageServiceTransaction|undefined = olderChain.reverse().find((olderChainLink: StorageServiceTransaction) => {
      const olderLastLinkInNewerChainIdx: number = newerChain.findIndex((newerChainLink: StorageServiceTransaction) => newerChainLink.id === olderChainLink.id);
      if(olderLastLinkInNewerChainIdx > -1) {
        return true;
      }

      return false;
    });

    if(typeof commonLink === 'undefined') {
      throw new Error('Unrelated chains!');
    }

    const commonLinkInNewerChainIdx: number = newerChain.findIndex((chainLink: StorageServiceTransaction) => chainLink.id === commonLink.id);
    const commonLinkInOlderChainIdx: number = olderChain.findIndex((chainLink: StorageServiceTransaction) => chainLink.id === commonLink.id);

    console.debug(`Latest common link was found in newer chain (length: ${newerChain.length}) at index ${commonLinkInNewerChainIdx}, in older chain (length: ${olderChain.length} at index ${commonLinkInOlderChainIdx}).`);

    // Common link in older chain is last link, we can simply pick the newer chain
    if(commonLinkInOlderChainIdx === (olderChain.length - 1)) {
      console.debug(`Common link in older chain is last link, picking newer chain.`);
      return newerChain;
    }

    /*
     * If we reached this point it means that from the common link on both
     * chains have parted ways and contain of unrelated transactions.
     */
     return merger(newerChain, commonLinkInNewerChainIdx, olderChain, commonLinkInOlderChainIdx);
  }

}
