import { useState } from 'react';
import { Settings, FileText, BetweenHorizonalStart, ChartScatter } from 'lucide-react';

// Define the menu item type
interface MenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  page: string;
}

interface SidebarMenuProps {
  setCurrentPage: (page: string) => void;
  activeItem: string | null;
  setActiveItem: (id: string) => void;
}

const SidebarMenu: React.FC<SidebarMenuProps> = ({ setCurrentPage, activeItem, setActiveItem }) => {
  const [tooltip, setTooltip] = useState<string | null>(null);

  // Sample menu items for a database tool
  const menuItems: MenuItem[] = [
    {
      id: 'feed-my-db',
      icon: <BetweenHorizonalStart size={20} />,
      label: 'Data Generator',
      page: 'feed-my-db',
    },
    {
      id: 'data-visualization',
      icon: <ChartScatter size={20} />,
      label: 'Data Visualization',
      page: 'data-visualization',
    },
    {
      id: 'queries',
      icon: <FileText size={20} />,
      label: 'SQL Editor',
      page: 'sql-editor',
    },
    {
      id: 'settings',
      icon: <Settings size={20} />,
      label: 'Settings',
      page: 'settings',
    },
  ];

  return (
    <div className="h-screen bg-gray-800 text-white flex flex-col w-16 transform transition-transform duration-300 ease-in-out">
      <div className="flex-1 py-4">
        {menuItems.map((item) => (
          <div
            key={item.id}
            className={`flex items-center py-3 px-4 cursor-pointer transition-colors duration-200 relative
              ${activeItem === item.id ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
            onClick={() => {
              setActiveItem(item.id);
              setCurrentPage(item.page);
            }}
            onMouseEnter={() => setTooltip(item.label)}
            onMouseLeave={() => setTooltip(null)}
          >
            <div className="text-gray-300">{item.icon}</div>
            {tooltip === item.label && (
              <div className="absolute left-16 bg-gray-900 text-white px-2 py-1 rounded text-sm whitespace-nowrap z-10">
                {item.label}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700 flex justify-center">
        <Settings
          size={20}
          className="text-gray-400 hover:text-white cursor-pointer"
          onClick={() => {
            setActiveItem('settings');
            setCurrentPage('settings');
          }}
          onMouseEnter={() => setTooltip('Settings')}
          onMouseLeave={() => setTooltip(null)}
        />
      </div>
    </div>
  );
};

export default SidebarMenu;
