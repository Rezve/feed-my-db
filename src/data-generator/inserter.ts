import { Knex } from 'knex';
import DatabaseConnection from './connection';
import { BrowserWindow } from 'electron';

export class DataInserter {
  public db: Knex;
  private shouldStopProcess: boolean;

  constructor(
    private DBConnection: DatabaseConnection,
    private batchSize: number,
    private concurrentBatches: number,
    private logInterval: number
  ) {
    this.db = this.DBConnection.getKnex();
    this.shouldStopProcess = false;
  }

  public stop() {
    this.shouldStopProcess = true;
  }

  private async insertSingleBatch(
    tableName: string,
    rows: any[],
    primaryKeyColumn: string
  ): Promise<{ count: number; keys: any[]; failedRows?: any[] }> {
    try {
      // Use OUTPUT for primary keys
      const result = await this.db(tableName)
        .insert(rows)
        .returning(`${primaryKeyColumn || '*'}`);

      const keys = result.map((row: any) => row[primaryKeyColumn]);
      return { count: rows.length, keys };
    } catch (error: any) {
      if (error.number === 2627 || error.message.includes('Violation of UNIQUE KEY constraint')) {
        console.warn(`Duplicate key violation in ${tableName}: ${error.message}`);
        return { count: 0, keys: [], failedRows: rows };
      }
      throw new Error(`Failed to insert batch into ${tableName}: ${error.message}`);
    }
  }

  public async insertAll(
    window: BrowserWindow,
    tableName: string,
    dataGenerator: () => any,
    totalRecords: number,
    primaryKeyColumn: string
  ): Promise<{ count: number; primaryKeys: any[]; tableName: string }> {
    this.shouldStopProcess = false;

    let insertedRecords = 0;
    const primaryKeys: any[] = [];
    const maxRetries = 5; // Increased for large datasets
    const retryQueue: { rows: any[]; attempt: number }[] = [];
    const startTime = Date.now();
    let batchIndex = 0;

    // Cache generated rows to reduce Faker.js calls
    const rowCache: any[] = [];
    const fillCache = (count: number) => {
      for (let i = 0; i < count; i++) {
        rowCache.push(dataGenerator());
      }
    };

    // Generate initial cache
    fillCache(Math.min(this.batchSize * this.concurrentBatches, totalRecords));

    while (insertedRecords < totalRecords && !this.shouldStopProcess) {
      const recordsNeeded = Math.min(this.batchSize, totalRecords - insertedRecords);
      if (recordsNeeded <= 0 && retryQueue.length === 0) break;

      const batchPromises: Promise<{ count: number; keys: any[]; failedRows?: any[] }>[] = [];
      const batchesToProcess: { rows: any[]; isRetry: boolean; attempt: number }[] = [];

      // Add new rows from cache
      if (recordsNeeded > 0 && rowCache.length < recordsNeeded) {
        fillCache(recordsNeeded - rowCache.length);
      }
      if (recordsNeeded > 0) {
        const rows = rowCache.splice(0, recordsNeeded);
        batchesToProcess.push({ rows, isRetry: false, attempt: 1 });
      }

      // Add retry batches
      while (retryQueue.length > 0 && batchesToProcess.length < this.concurrentBatches) {
        const retryBatch = retryQueue.shift()!;
        if (retryBatch.attempt <= maxRetries) {
          const newRows = this.generateBatch(retryBatch.rows.length, dataGenerator);
          batchesToProcess.push({ rows: newRows, isRetry: true, attempt: retryBatch.attempt });
        }
      }

      for (const { rows, attempt } of batchesToProcess) {
        if (this.shouldStopProcess) break;

        batchPromises.push(
          this.insertSingleBatch(tableName, rows, primaryKeyColumn).then(({ count, keys, failedRows }) => {
            insertedRecords += count;
            primaryKeys.push(...keys);

            if (failedRows && failedRows.length > 0 && attempt < maxRetries) {
              retryQueue.push({ rows: failedRows, attempt: attempt + 1 });
              window.webContents.send('app:log', {
                log: `🔄 Retrying ${failedRows.length} rows in ${tableName} (attempt ${attempt} of ${maxRetries})`,
              });
            } else if (failedRows) {
              window.webContents.send('app:log', {
                log: `⚠️ Skipped ${failedRows.length} rows in ${tableName} after ${maxRetries} retries.`,
              });
            }

            return { count, keys, failedRows };
          })
        );
        batchIndex++;
      }

      await Promise.all(batchPromises);

      // Progress update
      const elapsedTime = (Date.now() - startTime) / 1000;
      const percentage = (insertedRecords / totalRecords) * 100;
      const recordsPerSecond = insertedRecords / elapsedTime || 1;
      const estimatedTimeRemaining = (totalRecords - insertedRecords) / recordsPerSecond;

      if (batchIndex % this.logInterval === 0 || insertedRecords >= totalRecords) {
        this.sendProgressUpdate(window, {
          insertedRecords,
          totalRecords,
          percentage,
          elapsedTime,
          estimatedTimeRemaining,
          currentBatch: batchIndex,
          totalBatches: Math.ceil(totalRecords / this.batchSize),
        });
      }
    }

    if (insertedRecords < totalRecords) {
      window.webContents.send('app:log', {
        log: `⚠️ Inserted ${insertedRecords} of ${totalRecords} requested records for ${tableName} due to duplicates or stop request.`,
      });
    }

    return { count: insertedRecords, primaryKeys, tableName };
  }

  private sendProgressUpdate(
    window: BrowserWindow,
    progress: {
      insertedRecords: number;
      totalRecords: number;
      percentage: number;
      elapsedTime: number;
      estimatedTimeRemaining: number;
      currentBatch: number;
      totalBatches: number;
      stopped?: boolean;
    }
  ) {
    window.webContents.send('app:progress', {
      insertedRecords: progress.insertedRecords,
      totalRecords: progress.totalRecords,
      percentage: progress.percentage.toFixed(2),
      elapsedTime: progress.elapsedTime.toFixed(1),
      estimatedTimeRemaining: progress.estimatedTimeRemaining.toFixed(1),
      currentBatch: progress.currentBatch,
      totalBatches: progress.totalBatches,
      stopped: progress.stopped || false,
      status: progress.stopped ? 'Stopped' : 'Processing',
    });
  }

  private generateBatch(recordsToGenerate: number, dataGenerator: () => any): any[] {
    const rows: any[] = [];
    for (let i = 0; i < recordsToGenerate; i++) {
      rows.push(dataGenerator());
    }
    return rows;
  }

  public async getTotalCount(tableName: string): Promise<number> {
    const result = await this.db(tableName).count('* as total').first();
    return Number(result?.total) || 0;
  }
}
