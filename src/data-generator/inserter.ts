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
  ): Promise<{ count: number; primaryKeys: any[] }> {
    this.shouldStopProcess = false;

    const totalBatches = Math.ceil(totalRecords / this.batchSize);
    let insertedRecords = 0;
    const primaryKeys: any[] = [];
    const batchPromises: Promise<{ count: number; keys: any[]; failedRows?: any[] }>[] = [];
    const startTime = Date.now();
    const maxRetries = 3; // Limit retries per batch
    const retryQueue: { rows: any[]; attempt: number }[] = [];

    // Initial progress update
    this.sendProgressUpdate(window, {
      insertedRecords,
      totalRecords,
      percentage: 0,
      elapsedTime: 0,
      estimatedTimeRemaining: 0,
      currentBatch: 0,
      totalBatches,
    });

    for (let i = 0; i < totalBatches; i += this.concurrentBatches) {
      const currentBatchSize = Math.min(this.concurrentBatches, totalBatches - i);

      if (this.shouldStopProcess) {
        this.sendProgressUpdate(window, {
          insertedRecords,
          totalRecords,
          percentage: (insertedRecords / totalRecords) * 100,
          elapsedTime: (Date.now() - startTime) / 1000,
          estimatedTimeRemaining: 0,
          currentBatch: i,
          totalBatches,
          stopped: true,
        });
        break;
      }

      // Process new batches and retries
      const batchesToProcess: { rows: any[]; isRetry: boolean; attempt: number }[] = [];
      const recordsNeeded = Math.min(this.batchSize * currentBatchSize, totalRecords - insertedRecords);

      // Add new rows if needed
      if (recordsNeeded > 0 && retryQueue.length === 0) {
        const recordsToGenerate = Math.min(recordsNeeded, this.batchSize);
        const rows = this.generateBatch(recordsToGenerate, dataGenerator);
        batchesToProcess.push({ rows, isRetry: false, attempt: 1 });
      }

      // Add retry batches
      while (retryQueue.length > 0 && batchesToProcess.length < currentBatchSize) {
        const retryBatch = retryQueue.shift()!;
        if (retryBatch.attempt <= maxRetries) {
          // Regenerate rows to avoid duplicates
          const newRows = this.generateBatch(retryBatch.rows.length, dataGenerator);
          batchesToProcess.push({ rows: newRows, isRetry: true, attempt: retryBatch.attempt });
        } else {
          window.webContents.send('app:log', {
            log: `⚠️ Max retries (${maxRetries}) reached for batch in ${tableName}. Skipping ${retryBatch.rows.length} rows.`,
          });
        }
      }

      for (let j = 0; j < batchesToProcess.length; j++) {
        const { rows, attempt } = batchesToProcess[j];
        const batchIndex = i + j;

        if (this.shouldStopProcess) {
          break;
        }

        if (rows.length > 0) {
          batchPromises.push(
            this.insertSingleBatch(tableName, rows, primaryKeyColumn).then(({ count, keys, failedRows }) => {
              insertedRecords += count;
              primaryKeys.push(...keys);

              if (failedRows && failedRows.length > 0 && attempt < maxRetries) {
                // Schedule retry with incremented attempt
                retryQueue.push({ rows: failedRows, attempt: attempt + 1 });
                window.webContents.send('app:log', {
                  log: `🔄 Retrying ${failedRows.length} rows in ${tableName} (attempt ${attempt} of ${maxRetries})`,
                });
              } else if (failedRows && attempt >= maxRetries) {
                window.webContents.send('app:log', {
                  log: `⚠️ Max retries (${maxRetries}) reached for ${failedRows.length} rows in ${tableName}.`,
                });
              }

              const elapsedTime = (Date.now() - startTime) / 1000;
              const percentage = (insertedRecords / totalRecords) * 100;
              const recordsPerSecond = insertedRecords / elapsedTime || 1;
              const estimatedTimeRemaining = (totalRecords - insertedRecords) / recordsPerSecond;

              if (batchIndex % this.logInterval === 0 || batchIndex === totalBatches - 1 || percentage === 100) {
                this.sendProgressUpdate(window, {
                  insertedRecords,
                  totalRecords,
                  percentage,
                  elapsedTime,
                  estimatedTimeRemaining,
                  currentBatch: batchIndex + 1,
                  totalBatches,
                });
              }
              return { count, keys, failedRows };
            })
          );
        }
      }

      await Promise.all(batchPromises.splice(0));
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    // Handle any remaining retries
    while (retryQueue.length > 0 && !this.shouldStopProcess) {
      const { rows, attempt } = retryQueue.shift()!;
      if (attempt <= maxRetries) {
        const newRows = this.generateBatch(rows.length, dataGenerator);
        const { count, keys, failedRows } = await this.insertSingleBatch(tableName, newRows, primaryKeyColumn);
        insertedRecords += count;
        primaryKeys.push(...keys);
        if (failedRows && failedRows.length > 0 && attempt < maxRetries) {
          retryQueue.push({ rows: failedRows, attempt: attempt + 1 });
          window.webContents.send('app:log', {
            log: `🔄 Retrying ${failedRows.length} rows in ${tableName} (attempt ${attempt} of ${maxRetries})`,
          });
        }
      }
    }

    if (insertedRecords < totalRecords) {
      window.webContents.send('app:log', {
        log: `⚠️ Inserted ${insertedRecords} of ${totalRecords} requested records for ${tableName} due to duplicate constraints.`,
      });
    }

    return { count: insertedRecords, primaryKeys };
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
