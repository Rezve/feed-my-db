import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { decrypt } from './crypto';
import { getKey } from './setup-keychain';

const configPath = path.join(app.getPath('userData'), 'config.json');

export async function saveConfig(config: any) {
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('DB config saved successfully');
  } catch (err) {
    console.error('Error saving DB config:', err);
  }
}

export async function loadConfig() {
  try {
    const stringData = await fs.readFile(configPath, 'utf8');
    if (!stringData) {
      return {};
    }
    const config = JSON.parse(stringData);
    const dbConfig = config.dbConfig;
    if (dbConfig?.encryptedPassword) {
      const key = await getKey();
      if (!key) {
        return {};
      }
      dbConfig.password = decrypt(dbConfig?.encryptedPassword?.encryptedData, key, dbConfig?.encryptedPassword?.iv);
      delete dbConfig.encryptedPassword;
    }

    return dbConfig || {};
  } catch (err: any) {
    console.error('Error loading DB config:', err.message);
    return null;
  }
}
