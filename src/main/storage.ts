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
    const config = JSON.parse(stringData);
    if (config.encryptedPassword) {
      const key = await getKey('encryptionKey');
      if (!key) {
        return {};
      }
      config.password = decrypt(config?.encryptedPassword?.encryptedData, key, config?.encryptedPassword?.iv);
      delete config.encryptedPassword;
    }

    return config;
  } catch (err) {
    console.error('Error loading DB config:', err);
    return null;
  }
}
