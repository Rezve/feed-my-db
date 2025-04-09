import React, { useEffect, useState } from 'react';

interface ProgressBarProps {
  progress: Progress;
}

interface Progress {
  insertedRecords: number;
  totalRecords: number;
  percentage: string;
  elapsedTime: string;
  estimatedTimeRemaining: string;
  currentBatch: number;
  totalBatches: number;
  status: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  // Default values to prevent undefined errors
  const {
    insertedRecords = 0,
    totalRecords = 0,
    percentage = '0.00',
    elapsedTime = '0.0',
    estimatedTimeRemaining = '0.0',
    currentBatch = 0,
    totalBatches = 0,
    // status = 'Processing'
  } = progress || {};

  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    const handleProgress = (status: string) => {
      if (!status.includes('Error')) {
        setStatus(status);
      }
    };
    window.electronAPI.on('app:status', handleProgress);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-semibold text-gray-800">Progress</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs text-white ${
            status.toLowerCase() === 'processing' ? 'bg-green-500' : 'bg-gray-500'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden relative mb-2">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300 flex items-center justify-end"
          style={{ width: `${percentage}%` }}
        >
          <span className="text-white text-xs font-bold pr-2 text-shadow">{percentage}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex flex-col">
          <span className="text-gray-600">Records</span>
          <span className="text-gray-800 font-medium">
            {insertedRecords}/{totalRecords}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-600">Batches</span>
          <span className="text-gray-800 font-medium">
            {currentBatch}/{totalBatches}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-600">Elapsed</span>
          <span className="text-gray-800 font-medium">{elapsedTime}s</span>
        </div>
        <div className="flex flex-col">
          <span className="text-gray-600">Remaining</span>
          <span className="text-gray-800 font-medium">{estimatedTimeRemaining}s</span>
        </div>
      </div>
    </div>
  );
};

// Example usage with Electron IPC
const ProgressBarWithIPC: React.FC = () => {
  const [progress, setProgress] = useState({} as any);

  useEffect(() => {
    window.electronAPI.on('app:progress', (progressData: any) => {
      setProgress(progressData);
    });
  }, []);

  return <ProgressBar progress={progress} />;
};

export default ProgressBarWithIPC;
