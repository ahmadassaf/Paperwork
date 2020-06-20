import { difference, intersection, omit } from 'lodash';
import { StorageServiceIndex } from './StorageService';

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
    }
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

}
