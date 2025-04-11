import { useEffect, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';

interface GeneratorFunctionProps {
  code: string;
  setCode: (code: string) => void;
  isConnected: boolean;
  isCodeConfirmed: boolean;
  setCodeConfirmed: (flag: boolean) => void;
  openTableConfigModal: (flag: boolean) => void;
}

const GeneratorFunction: React.FC<GeneratorFunctionProps> = ({
  isConnected,
  isCodeConfirmed,
  setCodeConfirmed,
  openTableConfigModal,
  code,
  setCode,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [sampleData, setSampleData] = useState<any[] | null>(null);
  const [hasCodeChanged, setHasCodeChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReadyAnimation, setShowReadyAnimation] = useState(false);

  useEffect(() => {
    window.electronAPI.on('app:code:result', (result) => {
      if (result.error) {
        setError(result.error);
        setSampleData(null);
      } else {
        setSampleData(Array.isArray(result) ? result : [result]);
        setError(null);

        setCodeConfirmed(true);
        // setConfirmButtonText('Confirmed');
        setHasCodeChanged(false);
      }
    });
  }, []);

  useEffect(() => {
    if (isConnected && !showReadyAnimation) {
      setShowReadyAnimation(true);
      setTimeout(() => setShowReadyAnimation(false), 5 * 1000);
    }
  }, [isConnected]);

  const handleRunCode = () => {
    setError(null);
    setSampleData(null);
    window.electronAPI.send('app:code', code);
  };

  const handleColumnConfiguration = () => {
    setHasCodeChanged(true);
    openTableConfigModal(true);
  };

  const renderTable = (data: any, index: number) => (
    <div key={index} className="mb-4">
      <h3 className="text-sm font-semibold mb-2">Table {index + 1}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="border-b border-gray-300">
                <td className="p-2 font-semibold border-r border-gray-300">{key}</td>
                <td className="p-2">{value instanceof Date ? value.toISOString() : String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div
      className={`editor-section ${isEditorOpen ? 'open' : 'closed'} bg-white border border-gray-300 rounded-md shadow-sm relative ${
        showReadyAnimation ? 'animate-border-pulse' : ''
      }`}
    >
      <div className={`relative ${!isConnected ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="section-header flex items-center justify-between p-2 bg-gray-200 border-b border-gray-300">
          <h2 className="text-sm font-semibold text-gray-800">Data Schema Editor</h2>
          <button
            className="toggle-btn w-6 h-6 flex items-center justify-center text-gray-700 bg-gray-300 rounded-md hover:bg-gray-400 transition-colors duration-200"
            onClick={() => setIsEditorOpen(!isEditorOpen)}
          >
            {isEditorOpen ? '-' : '+'}
          </button>
        </div>
  
        {isEditorOpen && (
          <div className="section-content p-4 flex gap-4">
            {/* Editor */}
            <div className="w-1/2 flex flex-col gap-4">
              <div className="editor-container bg-white border border-gray-300 rounded-md shadow-sm overflow-hidden">
                <MonacoEditor
                  height="40vh"
                  defaultLanguage="javascript"
                  value={code}
                  onChange={(value) => {
                    setCode(value || '');
                    if (isCodeConfirmed && !hasCodeChanged) {
                      setHasCodeChanged(true);
                    }
                  }}
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    fontFamily: "'Consolas', 'Courier New', monospace",
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    padding: { top: 8, bottom: 8 },
                  }}
                />
              </div>
  
              <div className="flex items-center">
                <button
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${isCodeConfirmed && !hasCodeChanged ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                  onClick={handleRunCode}
                  disabled={isCodeConfirmed && !hasCodeChanged}
                >
                  Preview Data
                </button>
                <button
                  className="px-4 ml-5 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  onClick={handleColumnConfiguration}
                >
                  Edit Schema
                </button>
              </div>
            </div>
  
            {/* Preview/Error Panel */}
            <div className="w-1/2 bg-gray-50 p-4 rounded-md border border-gray-300 h-[40vh] overflow-y-auto">
              {error ? (
                <div className="text-red-600 text-sm">Error: {error}</div>
              ) : sampleData ? (
                <div>{sampleData.map((data, index) => renderTable(data, index))}</div>
              ) : (
                <div className="text-gray-500 text-sm">Click 'Preview Data' to see results</div>
              )}
            </div>
          </div>
        )}
      </div>
  
      {/* Overlay */}
      {!isConnected && (
        <div className="absolute inset-0 bg-gray-200 bg-opacity-75 flex items-center justify-center z-10 animate-fade-in">
          <div className="bg-white px-4 py-2 rounded-md shadow-sm border border-gray-300">
            <p className="text-black text-sm font-medium">
              Connect to a database to start defining your data schema
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratorFunction;
