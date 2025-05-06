import React, { useState } from 'react';
import DataSchemaEditorPanel from '../components/DataSchemaEditorPanel';
import DataInsertionPanel from '../components/DataInsertionPanel';
import DBConfig from '../components/DBConfig';
import LiveLog from '../components/LiveLog';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import TableColumnSelectorModal from '../components/TableColumnSelectorModal';
import { BasicCode } from '../utils/sample-code';

const HomePage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tableNames, setTableNames] = useState<string[]>();
  const [isConnected, setIsConnected] = useState(false);
  const [isCodeConfirmed, setCodeConfirmed] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [code, setCode] = useState<string>(BasicCode);
  const handleSaveCode = (tableNames: string[], generatedCode: string) => {
    setTableNames(tableNames);
    setCode(generatedCode);
    // setCodeConfirmed(true);
    window.electronAPI.send('app:code', generatedCode);
  };

  const handleOpenModal = (flag: boolean) => {
    setIsModalOpen(flag);
  };

  return (
    <div className="flex flex-row h-screen">
      <PanelGroup direction="horizontal" autoSaveId="main-layout">
        {/* Left Panel */}
        <Panel defaultSize={30} minSize={20} className="m-5">
          <div className="flex flex-col h-full">
            <DBConfig
              isConnected={isConnected}
              setIsConnected={setIsConnected}
            />
            <DataInsertionPanel
              isConnected={isConnected}
              isRunning={isRunning}
              isCodeConfirmed={isCodeConfirmed}
              setIsRunning={setIsRunning}
              tableNames={tableNames}
              setIsModalOpen={setIsModalOpen}
            />
          </div>
        </Panel>

        {/* Horizontal Resize Handle */}
        <PanelResizeHandle className="border hover:border-blue-500 hover:bg-blue-100 transition" />

        {/* Right Panel */}
        <Panel minSize={20} className="mt-5">
          <PanelGroup direction="vertical" autoSaveId="right-panel-layout">
            {/* DataSchemaEditorPanel */}
            <Panel defaultSize={60} minSize={20}>
              <DataSchemaEditorPanel
                isConnected={isConnected}
                isCodeConfirmed={isCodeConfirmed}
                setCodeConfirmed={setCodeConfirmed}
                openTableConfigModal={handleOpenModal}
                code={code}
                setCode={setCode}
              />
            </Panel>

            {/* Vertical Resize Handle */}
            <PanelResizeHandle className="border hover:border-blue-500 hover:bg-blue-100 transition" />

            {/* LiveLog */}
            <Panel minSize={20}>
              <LiveLog />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Modal */}
      <TableColumnSelectorModal
        isConnected={isConnected}
        onSave={handleSaveCode}
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
      />
    </div>
  );
};

export default HomePage;
