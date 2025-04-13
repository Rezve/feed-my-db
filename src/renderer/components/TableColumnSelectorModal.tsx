import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from './notification/NotificationContext';

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
  const [isFakerModalOpen, setIsFakerModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addNotification } = useNotification();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Mock database fetch (replace with real DB call)
  useEffect(() => {
    window.electronAPI.on('app:fetch-tables:result', (result) => {
      if (result.error) {
        // setError(result.error);
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

  useEffect(() => {
    if (isFakerModalOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isFakerModalOpen]);

  // Update columns when table is selected
  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tableName = e.target.value;
    setSelectedTable(tableName);
    const table = tables.find((t: any) => t.name === tableName);
    setColumns(table ? table.columns : []);
    setFakerSelections({}); // Reset selections
    setIsSubmitted(false); // Reset submission state
  };

  // Open Faker modal for a specific column
  const openFakerModal = (columnName: string) => {
    setActiveColumn(columnName);
    setSearchQuery(''); // Reset search query when opening
    setIsFakerModalOpen(true);
  };

  // Handle Faker function selection
  const handleFakerChange = (columnName: string, fakerFunc: string) => {
    setFakerSelections((prev: any) => ({
      ...prev,
      [columnName]: fakerFunc,
    }));
    setIsFakerModalOpen(false);
    setActiveColumn(null);
    setSearchQuery(''); // Reset search query when selecting
  };

  // Generate code on save
  const handleCreateScript = () => {
    setIsSubmitted(true);
    if (!selectedTable) {
      addNotification('Please select a table.', 'error');
      return;
    }
    if (!columns.every((column: any) => column.isNullable || column.isIdentity || fakerSelections[column.name])) {
      addNotification('Please select Faker functions for all required columns.', 'error');
      return;
    }

    const code = `
// Welcome to the Data Schema Editor!
// This is your space to create custom fake data for your database.

// **File Scope**: 
// - Code outside the function runs ONCE when you click 'Test & Confirm'.
// - Use this area to pre-compute values, define helpers, or set up data that 
//   your 'generateFakeData' function will use. It's great for performance optimizations!
// - You have access to the '@faker-js/faker' library via 'require('@faker-js/faker')'.

const { faker } = require('@faker-js/faker');

function generateFakeData() {
  return {
    ${Object.entries(fakerSelections)
      .filter(([column]) => !columns.find((c: any) => c.name === column && c.isIdentity))
      .map(([column, fakerFunc]) => `${column}: ${fakerFunc}()`)
      .join(',\n    ')}
  };
}

// - Tip: Click "Test & Confirm" to view and verify your code!.
`.trim();

    onSave(selectedTable, code);
    addNotification('Code generated successfully', 'success');
    setIsModalOpen(false);
  };

  // Auto-select Faker functions for all columns
  const handleAutoSelect = () => {
    const newSelections: { [key: string]: string } = {};
    columns.forEach((column: any) => {
      const match = findBestFakerMatch(column.name);
      if (match) {
        newSelections[column.name] = match;
      }
    });
    setFakerSelections(newSelections);
    addNotification('Auto-selected Faker functions for columns', 'success');
  };

  // Find best matching Faker function for a column
  const findBestFakerMatch = (columnName: string) => {
    const normalizedColumn = normalizeColumnName(columnName);
    let bestMatch: { value: string; score: number } | null = null;

    for (const module of fakerOptions) {
      for (const method of module.methods) {
        const normalizedLabel = method.label.toLowerCase();
        if (fuzzySearch(normalizedColumn, normalizedLabel)) {
          const score = normalizedLabel.includes(normalizedColumn)
            ? 1 // Exact or strong partial match
            : 0.5; // Fuzzy match
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { value: method.value, score };
          }
        }
      }
    }

    return bestMatch ? bestMatch.value : null;
  };

  // Normalize column name for matching
  const normalizeColumnName = (columnName: string): string => {
    return columnName
      .split(/[-_]/) // Split on hyphens or underscores
      .flatMap((word) =>
        word
          .replace(/([A-Z])/g, ' $1') // Split on capital letters (e.g., FirstName -> First Name)
          .trim()
          .split(/\s+/)
      )
      .join(' ')
      .toLowerCase();
  };

  // Faker.js options, grouped by module
  const fakerOptions = [
    {
      module: 'Airline',
      methods: [
        { value: 'faker.airline.aircraftType', label: 'Aircraft Type' },
        { value: 'faker.airline.airport', label: 'Airport' },
      ],
    },
    {
      module: 'Animal',
      methods: [
        { value: 'faker.animal.dog', label: 'Dog Breed' },
        { value: 'faker.animal.cat', label: 'Cat Breed' },
      ],
    },
    {
      module: 'Color',
      methods: [
        { value: 'faker.color.human', label: 'Color Name' },
        { value: 'faker.color.rgb', label: 'RGB Color' },
      ],
    },
    {
      module: 'Commerce',
      methods: [
        { value: 'faker.commerce.productName', label: 'Product Name' },
        { value: 'faker.commerce.price', label: 'Price' },
      ],
    },
    {
      module: 'Company',
      methods: [
        { value: 'faker.company.name', label: 'Company Name' },
        { value: 'faker.company.catchPhrase', label: 'Catch Phrase' },
      ],
    },
    {
      module: 'Database',
      methods: [
        { value: 'faker.database.column', label: 'Column Name' },
        { value: 'faker.database.engine', label: 'Database Engine' },
      ],
    },
    {
      module: 'Date',
      methods: [
        { value: 'faker.date.past', label: 'Past Date' },
        { value: 'faker.date.future', label: 'Future Date' },
      ],
    },
    {
      module: 'Finance',
      methods: [
        { value: 'faker.finance.accountNumber', label: 'Account Number' },
        { value: 'faker.finance.transactionType', label: 'Transaction Type' },
      ],
    },
    {
      module: 'Git',
      methods: [
        { value: 'faker.git.commitMessage', label: 'Commit Message' },
        { value: 'faker.git.branch', label: 'Branch Name' },
      ],
    },
    {
      module: 'Hacker',
      methods: [
        { value: 'faker.hacker.phrase', label: 'Hacker Phrase' },
        { value: 'faker.hacker.noun', label: 'Hacker Noun' },
      ],
    },
    {
      module: 'Internet',
      methods: [
        { value: 'faker.internet.email', label: 'Email' },
        { value: 'faker.internet.url', label: 'URL' },
      ],
    },
    {
      module: 'Location',
      methods: [
        { value: 'faker.location.city', label: 'City' },
        { value: 'faker.location.zipCode', label: 'Zip Code' },
      ],
    },
    {
      module: 'Lorem',
      methods: [
        { value: 'faker.lorem.word', label: 'Word' },
        { value: 'faker.lorem.sentence', label: 'Sentence' },
      ],
    },
    {
      module: 'Music',
      methods: [
        { value: 'faker.music.genre', label: 'Music Genre' },
        { value: 'faker.music.songName', label: 'Song Name' },
      ],
    },
    {
      module: 'Number',
      methods: [
        { value: 'faker.number.int', label: 'Integer' },
        { value: 'faker.number.float', label: 'Float' },
      ],
    },
    {
      module: 'Person',
      methods: [
        { value: 'faker.person.firstName', label: 'First Name' },
        { value: 'faker.person.lastName', label: 'Last Name' },
        { value: 'faker.person.fullName', label: 'Full Name' },
      ],
    },
    {
      module: 'Phone',
      methods: [{ value: 'faker.phone.number', label: 'Phone Number' }],
    },
    {
      module: 'Science',
      methods: [
        { value: 'faker.science.chemicalElement', label: 'Chemical Element' },
        { value: 'faker.science.unit', label: 'Unit' },
      ],
    },
    {
      module: 'String',
      methods: [
        { value: 'faker.string.uuid', label: 'UUID' },
        { value: 'faker.string.alphanumeric', label: 'Alphanumeric' },
      ],
    },
    {
      module: 'System',
      methods: [
        { value: 'faker.system.fileName', label: 'File Name' },
        { value: 'faker.system.fileExt', label: 'File Extension' },
      ],
    },
    {
      module: 'Vehicle',
      methods: [
        { value: 'faker.vehicle.vehicle', label: 'Vehicle' },
        { value: 'faker.vehicle.manufacturer', label: 'Vehicle Manufacturer' },
      ],
    },
    {
      module: 'Word',
      methods: [
        { value: 'faker.word.adjective', label: 'Adjective' },
        { value: 'faker.word.noun', label: 'Noun' },
      ],
    },
  ];

  // Get label for selected Faker function
  const getFakerLabel = (fakerFunc: string) => {
    for (const module of fakerOptions) {
      const method = module.methods.find((m) => m.value === fakerFunc);
      if (method) return method.label;
    }
    return '-- Select Faker Function --';
  };

  // Fuzzy search function
  const fuzzySearch = (query: string, text: string): boolean => {
    if (!query) return true;
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, '');
    const normalizedText = text.toLowerCase().replace(/\s+/g, '');
    let queryIndex = 0;
    for (let i = 0; i < normalizedText.length && queryIndex < normalizedQuery.length; i++) {
      if (normalizedText[i] === normalizedQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === normalizedQuery.length;
  };

  // Filter Faker options based on search query
  const filteredFakerOptions = fakerOptions
    .map((module) => {
      const moduleMatches = fuzzySearch(searchQuery, module.module);
      const filteredMethods = moduleMatches
        ? module.methods // Show all methods if module name matches
        : module.methods.filter((method) => fuzzySearch(searchQuery, method.label));
      return {
        ...module,
        methods: filteredMethods,
      };
    })
    .filter((module) => module.methods.length > 0);

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
                    <td className="p-2 text-sm text-gray-700">
                      {column.name}
                      {!column.isNullable && !column.isIdentity && !fakerSelections[column.name] && (
                        <span className="text-red-600 text-xs ml-2">Required</span>
                      )}
                      {column.isIdentity && <span className="text-blue-600 text-xs ml-2">Auto-generated</span>}
                    </td>
                    <td className="p-2 text-sm text-gray-700">{column.type}</td>
                    <td className="p-2 text-sm text-gray-700">{column.maxLength}</td>
                    <td className="p-2">
                      {column.isIdentity ? (
                        <span className="text-gray-500 text-sm">Not applicable</span>
                      ) : (
                        <button
                          onClick={() => openFakerModal(column.name)}
                          className={`w-full px-2 py-1 text-left text-sm border rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isSubmitted && !column.isNullable && !fakerSelections[column.name]
                              ? 'border-red-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {getFakerLabel(fakerSelections[column.name] || '')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          {selectedTable && (
            <button
              onClick={handleAutoSelect}
              className="px-4 mr-5 py-2 bg-gray-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              ✨ Try Auto Select
            </button>
          )}
          <button
            onClick={handleCreateScript}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Create Script
          </button>
        </div>
      </div>

      {/* Faker Function Modal */}
      {isFakerModalOpen && activeColumn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Select Faker Function</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => {
                  setIsFakerModalOpen(false);
                  setSearchQuery('');
                }}
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-4">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by module or function..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filtered Faker Options */}
            {filteredFakerOptions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFakerOptions.map((module) => (
                  <div key={module.module} className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{module.module}</h4>
                    <div className="space-y-1">
                      {module.methods.map((method) => (
                        <button
                          key={method.value}
                          onClick={() => handleFakerChange(activeColumn, method.value)}
                          className="w-full text-left px-3 py-1 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-md"
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500">No results found for "{searchQuery}".</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TableColumnSelectorModal;
