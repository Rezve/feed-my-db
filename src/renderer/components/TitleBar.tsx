const TitleBar: React.FC = () => {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-800 text-white" style={{ webkitAppRegion: 'drag' }}>
      <span className="text-sm font-medium">Feed My DB</span>
      <div className="flex flex-row space-x-1" style={{ webkitAppRegion: 'no-drag' }}>
        <button
          className="w-8 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200"
          onClick={() => window.electronAPI.send('window:minimize')}
        >
          −
        </button>
        <button
          className="w-8 h-6 flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200"
          onClick={() => window.electronAPI.send('window:maximize')}
        >
          □
        </button>
        <button
          className="w-8 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded-md transition-colors duration-200"
          onClick={() => window.electronAPI.send('window:close')}
        >
          ✕
        </button>
      </div>
    </div>
  );
};
export default TitleBar;
