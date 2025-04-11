import { useEffect, useState } from 'react';
import { IPCService } from '../services/ipc-service';

export interface BatchConfig {
  tableName: string;
  totalRecords: number;
  batchSize: number;
  concurrentBatches: number;
}

interface BatchConfigProps {
  isConnected: boolean;
  tableName: string;
  isRunning: boolean;
  isCodeConfirmed: boolean;
  setIsRunning: (flag: boolean) => void;
}

const BatchConfig: React.FC<BatchConfigProps> = ({ isRunning, isCodeConfirmed, setIsRunning, tableName }) => {
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [totalRecords, setTotalRecords] = useState<number>(1000);
  const [batchSize, setBatchSize] = useState<number>(100);
  const [concurrentBatches, setConcurrentBatches] = useState<number>(2);
  const [showReadyAnimation, setShowReadyAnimation] = useState(false);

  const handleStart = async () => {
    const batchConfig: BatchConfig = {
      tableName,
      totalRecords,
      batchSize,
      concurrentBatches,
    };
    // TODO: add batch config validation
    await IPCService.start(batchConfig);
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
    IPCService.stop();
  };

  useEffect(() => {
    const handleProgress = () => {
      setIsRunning(false);
    };
    window.electronAPI.on('app:complete', handleProgress);
  }, []);

  useEffect(() => {
    if (isCodeConfirmed && !showReadyAnimation) {
      setShowReadyAnimation(true);
      setTimeout(() => setShowReadyAnimation(false), 5 * 1000);
    }
  }, [isCodeConfirmed]);

  return (
    <div
      className={`config-section ${
        isConfigOpen ? 'open' : 'closed'
      } bg-white border border-gray-300 rounded-md shadow-sm relative ${!isConfigOpen ? 'opacity-50' : ''}
      ${showReadyAnimation ? 'animate-border-pulse' : ''}
        `}
    >
      {/* Overlay if not ready */}
      {/* {!isCodeConfirmed && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-10 animate-fade-in">
          <div className="bg-white px-4 py-2 rounded-md shadow-sm border border-gray-300">
            <p className="text-black text-sm font-medium">
              Generate and preview data to enable batch insertion
            </p>
          </div>
        </div>
      )} */}
      {/* Section Header */}
      <div className="section-header flex items-center justify-between p-2 bg-gray-200 border-b border-gray-300">
        <h2 className="text-sm font-semibold text-gray-800">Data Insertion</h2>
        <button
          className="toggle-btn w-6 h-6 flex items-center justify-center text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400 transition-colors duration-200"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
        >
          {isConfigOpen ? '-' : '+'}
        </button>
      </div>

      {/* Section Content (Visible when open) */}
      {isConfigOpen && (
        <div className="section-content p-4">
          <div className="config-grid grid grid-cols-2 gap-4">
            {/* Table Name */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Selected Table</label>
              <input
                type="text"
                value={tableName}
                disabled={true}
                readOnly={true}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>
            {/* Total Records */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Total Records</label>
              <input
                type="number"
                value={totalRecords}
                onChange={(e) => setTotalRecords(Math.max(1, parseInt(e.target.value)))}
                disabled={isRunning}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* Batch Size */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Batch Size</label>
              <input
                type="number"
                value={batchSize}
                onChange={(e) => setBatchSize(Math.max(1, parseInt(e.target.value)))}
                disabled={isRunning}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

            {/* Concurrent Batches */}
            <div className="config-item flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">Concurrent Batches</label>
              <input
                type="number"
                value={concurrentBatches}
                onChange={(e) => setConcurrentBatches(Math.max(1, parseInt(e.target.value)))}
                disabled={isRunning}
                className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500`}
              />
            </div>

          </div>

          {/* Controls */}
          <div className="controls mt-4 flex space-x-2">
            <button
              onClick={handleStart}
              disabled={isRunning || !isCodeConfirmed}
              className={`w-full py-2 px-4 text-sm font-semibold text-white rounded-md shadow-sm transition-colors duration-200 ${
                isRunning || !isCodeConfirmed
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              Insert Data
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className={`w-full py-2 px-4 text-sm font-semibold text-white rounded-md shadow-sm transition-colors duration-200 ${
                !isRunning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
              }`}
            >
              Stop
            </button>
          </div>
          {!isCodeConfirmed && <div className="mt-5 text-sm italic text-gray-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
              className="inline mr-2 align-middle"
            >
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
              <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 .876-.252 1.02-.598l.088-.416c.066-.3.04-.431-.225-.492l-.451-.084.738-3.468c.194-.897-.105-1.319-.808-1.319z" />
              <circle cx="8" cy="4.5" r="1" />
            </svg>
            <span className="inline align-middle">Generate and preview data to enable batch insertion</span>
          </div>}
        </div>
      )}
    </div>
  );
};

export default BatchConfig;
