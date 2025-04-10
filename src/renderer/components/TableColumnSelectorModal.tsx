import React, { useState, useEffect } from 'react';

interface TableColumnSelectorModalProps {
  isConnected: boolean;
  isModalOpen: boolean;
  onSave: (tableName: string, code: string) => void;
  setIsModalOpen: (flag: boolean) => void;
}

const TableColumnSelectorModal: React.FC<TableColumnSelectorModalProps> = ({
  isConnected,
  onSave,
  setIsModalOpen,
  isModalOpen,
}) => {
  const [selectedTable, setSelectedTable] = useState('');
  const [tables, setTables] = useState([] as any);
  const [columns, setColumns] = useState([] as any);
  const [fakerSelections, setFakerSelections] = useState({} as any);

  // Mock database fetch (replace with real DB call)
  useEffect(() => {
    window.electronAPI.on('app:fetch-tables:result', (result) => {
      if (result.error) {
        //   setError(result.error);
      } else {
        setTables(result.data);
      }
    });

    if (isConnected) {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
      setSelectedTable('');
      setColumns([]);
      setFakerSelections({});
    }
  }, [isConnected]);

  // Update columns when table is selected
  const handleTableChange = (e: any) => {
    const tableName = e.target.value;
    setSelectedTable(tableName);
    const table = tables.find((t: any) => t.name === tableName);
    setColumns(table ? table.columns : []);
    setFakerSelections({}); // Reset selections
  };

  // Update faker function selection for a column
  const handleFakerChange = (columnName: any, fakerFunc: any) => {
    setFakerSelections((prev: any) => ({
      ...prev,
      [columnName]: fakerFunc,
    }));
  };

  // Faker.js options (simplified list, expand as needed)
  const fakerOptions = [
    { value: 'faker.datatype.number', label: 'Number' },
    { value: 'faker.name.firstName', label: 'First Name' },
    { value: 'faker.internet.email', label: 'Email' },
    { value: 'faker.lorem.word', label: 'Word' },
    { value: 'faker.commerce.price', label: 'Price' },
  ];

  // Generate code on save
  const handleSave = () => {
    if (!selectedTable || Object.keys(fakerSelections).length === 0) {
      alert('Please select a table and configure at least one column.');
      return;
    }

    const code = `
// Welcome to the Generator Function Editor!
// This is your space to create custom fake data for your application.

// **File Scope**: 
// - Code outside the function runs ONCE when you validate/run it.
// - Use this area to pre-compute values, define helpers, or set up data that 
//   your 'generateFakeData' function will use. It’s great for performance optimizations!
// - You have access to the '@faker-js/faker' library via 'require('@faker-js/faker')'.

const { faker } = require('@faker-js/faker');

function generateFakeData() {
  return {
    ${Object.entries(fakerSelections)
      .map(([column, fakerFunc]) => `${column}: ${fakerFunc}()`)
      .join(',\n    ')}
  };
}

// Tip: Click "Run & Validate" to test and review sample data!
`.trim();

    onSave(selectedTable, code); // Pass generated code to parent (e.g., HomePage)
    setIsModalOpen(false);
  };

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Define Data Schema</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsModalOpen(false)}>
            ✕
          </button>
        </div>

        {/* Table Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Table</label>
          <select
            value={selectedTable}
            onChange={handleTableChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select a table --</option>
            {tables.map((table: any) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
        </div>

        {/* Column Table */}
        {selectedTable && columns.length > 0 && (
          <div className="mb-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200">
                  <th className="p-2 text-left text-sm font-semibold text-gray-800 border-b border-gray-300">
                    Table Column
                  </th>
                  <th className="p-2 text-left text-sm font-semibold text-gray-800 border-b border-gray-300">
                    Data Type
                  </th>
                  <th className="p-2 text-left text-sm font-semibold text-gray-800 border-b border-gray-300">
                    Max Length
                  </th>
                  <th className="p-2 text-left text-sm font-semibold text-gray-800 border-b border-gray-300">
                    Faker Function
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.map((column: any) => (
                  <tr key={column.name} className="border-b border-gray-200">
                    <td className="p-2 text-sm text-gray-700">{column.name}</td>
                    <td className="p-2 text-sm text-gray-700">{column.type}</td>
                    <td className="p-2 text-sm text-gray-700">{column.maxLength}</td>
                    <td className="p-2">
                      <select
                        value={fakerSelections[column.name] || ''}
                        onChange={(e) => handleFakerChange(column.name, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Select Faker Function --</option>
                        {fakerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableColumnSelectorModal;
