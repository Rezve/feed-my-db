import keytar from 'keytar';
import crypto from 'crypto';

// Unique Service name for this app
const SERVICE_NAME = 'feed-my-db';

let ENCRYPTION_KEY: any;

// Function to store a key
export async function storeKey(account: string) {
  try {
    // we are generating key from main process
    // first checking if key is available for the account
    // if exists means we already stored this key, nothing to save again
    let key = await getKey(account);
    if (key) {
      return key;
    }

    key = crypto.randomBytes(32);
    await keytar.setPassword(SERVICE_NAME, account, key.toString('hex'));
    console.log(`Key stored successfully for account: ${account}`);
    return key;
  } catch (err) {
    console.error('Error storing key:', err);
  }
}

export async function getKey(account: string = 'encryptionKey') {
  try {
    // returned from memory
    if (ENCRYPTION_KEY) {
      console.log(`Key retrieved for account: ${account} from cache`);
      return Buffer.from(ENCRYPTION_KEY, 'hex');
    }

    const key = await keytar.getPassword(SERVICE_NAME, account);
    if (key) {
      ENCRYPTION_KEY = key;
      console.log(`Key retrieved for account: ${account}`);
      return Buffer.from(key, 'hex');
    } else {
      console.log(`No key found for account: ${account}, creating one`);
      const newKey = crypto.randomBytes(32);
      ENCRYPTION_KEY = newKey;
      await keytar.setPassword(SERVICE_NAME, account, newKey.toString('hex'));
      return newKey;
    }
  } catch (err) {
    console.error('Error retrieving key:', err);
    return null;
  }
}
