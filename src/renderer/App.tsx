import './styles/App.css';
import React, { useState } from 'react';
import { NotificationProvider } from './components/notification/NotificationContext';
import SidebarMenu from './components/SideBarMenu';
import StatusBar from './components/Statusbar';
import TitleBar from './components/TitleBar';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import { DataVisualizationPage } from './pages/DataVisualizationPage';
import { SQLEditorPage } from './pages/SQLEditorPage';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('feed-my-db');
  const [activeItem, setActiveItem] = useState<string | null>('feed-my-db');

  return (
    <NotificationProvider>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Title Bar */}
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Menu */}
          <SidebarMenu
            setCurrentPage={setCurrentPage}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
          />
          {/* Main Content Area */}
          <div className="flex-1 overflow-auto bg-gray-100">
            <div className={currentPage === 'feed-my-db' ? '' : 'hidden'}>
              <HomePage />
            </div>
            <div
              className={currentPage === 'data-visualization' ? '' : 'hidden'}
            >
              <DataVisualizationPage />
            </div>
            <div className={currentPage === 'sql-editor' ? '' : 'hidden'}>
              <SQLEditorPage />
            </div>
            <div className={currentPage === 'settings' ? '' : 'hidden'}>
              <SettingsPage />
            </div>
          </div>
        </div>
        <StatusBar />
      </div>
    </NotificationProvider>
  );
};

export default App;
