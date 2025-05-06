import { Minus, Square, X } from 'lucide-react';

const TitleBar = () => {
  return (
    <div className="flex flex-col titlebar">
      <div className="flex items-center justify-between p-2 bg-gray-800 text-white">
        <div className="flex items-center">
          <span className="text-sm font-medium ml-2">Feed My DB</span>
        </div>

        <div className="flex flex-row space-x-1 window-controls">
          <button
            className="w-8 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200"
            onClick={() => window.electronAPI.send('window:minimize')}
          >
            <Minus size={18} />
          </button>
          <button
            className="w-8 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200"
            onClick={() => window.electronAPI.send('window:maximize')}
          >
            <Square size={18} />
          </button>
          <button
            className="w-8 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-200"
            onClick={() => window.electronAPI.send('window:close')}
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
