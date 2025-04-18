import React, { useState, useEffect, useRef } from 'react';
import { useNotification } from './notification/NotificationContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCode, faMagicWandSparkles } from '@fortawesome/free-solid-svg-icons';
import { FakerOptions } from '../utils/faker-options';

interface TableColumnSelectorModalProps {
  isConnected: boolean;
  isModalOpen: boolean;
  onSave: (tableNames: string[], code: string) => void;
  setIsModalOpen: (flag: boolean) => void;
}

const TableColumnSelectorModal: React.FC<TableColumnSelectorModalProps> = ({
  isConnected,
  onSave,
  setIsModalOpen,
  isModalOpen,
}) => {
  const [selectedTable, setSelectedTable] = useState('');
  const [schema, setSchema] = useState([] as any);
  const [selectedTables, setSelectedTables] = useState<{
    [tableName: string]: { columns: any[]; fakerSelections: { [column: string]: string } };
  }>({});
  const [isFakerModalOpen, setIsFakerModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<{ tableName: string; columnName: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addNotification } = useNotification();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.electronAPI.on('app:fetch-tables:result', (result) => {
      if (result.error) {
        // setError(result.error);
      } else {
        setSchema(result.data);
      }
    });

    if (isConnected) {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
      setSelectedTable('');
      setSelectedTables({});
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

    if (!tableName) {
      setSelectedTables({});
      return;
    }

    const getReferencedTables = (tableName: string, visited: Set<string> = new Set()) => {
      if (visited.has(tableName)) return {};

      visited.add(tableName);
      const table = schema.tables.find((t: any) => t.name === tableName);
      if (!table) return {};

      const result: { [key: string]: { columns: any[]; fakerSelections: { [column: string]: string } } } = {
        [tableName]: { columns: table.columns, fakerSelections: {} },
      };

      // Find foreign key constraints where this table is the parent
      const foreignKeys = schema.constraints.filter((constraint: any) => constraint.ParentTable === tableName);
      for (const fk of foreignKeys) {
        const referencedTable = fk.ReferencedTable;
        const referencedData = getReferencedTables(referencedTable, visited);
        Object.assign(result, referencedData);
      }

      return result;
    };

    const tablesToInclude = getReferencedTables(tableName);
    setSelectedTables(tablesToInclude);
    setIsSubmitted(false);
  };

  // Open Faker modal for a specific column
  const openFakerModal = (tableName: string, columnName: string) => {
    setActiveColumn({ tableName, columnName });
    setSearchQuery('');
    setIsFakerModalOpen(true);
  };

  // Handle Faker function selection
  const handleFakerChange = (tableName: string, columnName: string, fakerFunc: string) => {
    setSelectedTables((prev) => ({
      ...prev,
      [tableName]: {
        ...prev[tableName],
        fakerSelections: {
          ...prev[tableName].fakerSelections,
          [columnName]: fakerFunc,
        },
      },
    }));
    setIsFakerModalOpen(false);
    setActiveColumn(null);
    setSearchQuery('');
  };

  const hasUniqueColumn = (obj: any) => Object.values(obj).some((t: any) => t.columns.some((c: any) => c.isUnique));

  // Generate code on save
  const handleCreateScript = () => {
    setIsSubmitted(true);
    if (!selectedTable) {
      addNotification('Please select a table.', 'error');
      return;
    }

    for (const [tableName, tableData] of Object.entries(selectedTables)) {
      const requiredColumnsMissing = tableData.columns.some(
        (column: any) =>
          !column.isNullable && !column.isIdentity && !column.foreignKey && !tableData.fakerSelections[column.name]
      );
      if (requiredColumnsMissing) {
        addNotification(`Please select Faker functions for all required columns in table ${tableName}.`, 'error');
        return;
      }
    }

    const codeParts: string[] = [];
    codeParts.push(`const { faker } = require('@faker-js/faker');`);

    if (hasUniqueColumn(selectedTables)) {
      codeParts.push(`let uniqueCounter = 0;`);
    }

    for (const [tableName, tableData] of Object.entries(selectedTables)) {
      const tableCode = `

function generateFake${tableName}Data() {
   // Column name: faker function or custom data
  return {
    ${Object.entries(tableData.fakerSelections)
      .filter(([column]) => !tableData.columns.find((c: any) => c.name === column && c.isIdentity))
      .map(([column, fakerFunc]) => {
        const columnDetails = tableData.columns.find((c: any) => c.name === column);
        if (columnDetails.isUnique) {
          return `
    // uniqueCounter ensures uniqueness when generating values,
    // especially helpful since faker has a limited set of unique outputs
    ${column}: \`\${uniqueCounter++}_\${${fakerFunc}()}\``;
        }
        return `${column}: ${fakerFunc}()`;
      })
      .join(',\n    ')}
  };
}`;
      codeParts.push(tableCode.trim());
    }

    const code = `
// Welcome to the Data Schema Editor!
// This script generates fake data for one or more database tables,
// supporting structure, relationships, and foreign key constraints.

// Each function below is responsible for generating fake data for a specific table.
// Within each returned object:
// - Keys represent table column names.
// - Values are faker functions or custom expressions used to generate data per row.

${codeParts.join('\n\n')}

// Main function to generate and return fake data for all tables
function generateFakeData() {
  return {
${Object.keys(selectedTables)
  .map((tableName) => `    '${tableName}': generateFake${tableName}Data(),`)
  .join('\n')}
  };
}
`.trim();

    onSave(Object.keys(selectedTables), code); // Pass table names
    addNotification('Code generated successfully for all related tables', 'success');
    setIsModalOpen(false);
  };

  // Auto-select Faker functions for all columns
  const handleAutoSelect = () => {
    const updatedTables = { ...selectedTables };
    let totalMatched = 0;
    let isApplied = 0;
    for (const [tableName, tableData] of Object.entries(updatedTables)) {
      const newSelections: { [key: string]: string } = {};
      tableData.columns.forEach((column: any) => {
        const match = findBestFakerMatch(column.name);
        if (match && !column.isIdentity && !column.foreignKey) {
          newSelections[column.name] = match;
          totalMatched++;
        }
      });
      if (!updatedTables[tableName].fakerSelections || !Object.keys(updatedTables[tableName].fakerSelections).length) {
        updatedTables[tableName].fakerSelections = newSelections;
        isApplied++;
      }
    }
    setSelectedTables(updatedTables);

    if (totalMatched > 0 && isApplied) {
      addNotification(
        `Success! Found ${totalMatched} matches. Some may have been skipped due to prior selections.`,
        'success'
      );
    } else if (totalMatched > 0) {
      addNotification(`Found ${totalMatched} Faker matches, but all were skipped (already selected).`, 'info');
    } else {
      addNotification('No suitable Faker functions were found for the related tables.', 'info');
    }
  };

  // Find best matching Faker function for a column
  const findBestFakerMatch = (columnName: string) => {
    const normalizedColumn = normalizeColumnName(columnName);
    let bestMatch: { value: string; score: number } | null = null;

    for (const module of FakerOptions) {
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
      .split(/[-_]/)
      .flatMap((word) =>
        word
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .split(/\s+/)
      )
      .join(' ')
      .toLowerCase();
  };

  // Faker.js options, grouped by module

  // Get label for selected Faker function
  const getFakerLabel = (tableName: string, fakerFunc: string | undefined) => {
    if (!fakerFunc) return '-- Select Faker Function --';
    for (const module of FakerOptions) {
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
  const filteredFakerOptions = FakerOptions.map((module) => {
    const moduleMatches = fuzzySearch(searchQuery, module.module);
    const filteredMethods = moduleMatches
      ? module.methods
      : module.methods.filter((method) => fuzzySearch(searchQuery, method.label));
    return {
      ...module,
      methods: filteredMethods,
    };
  }).filter((module) => module.methods.length > 0);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Create Data Template</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsModalOpen(false)}>
            ✕
          </button>
        </div>
        <p className="text-gray-600 mb-4">
          Choose tables and map their columns to Faker.js functions to create a template for generating fake data. This
          won't modify your database structure.
          {/* <button className="text-blue-500 text-sm hover:underline">Learn About Data Templates</button> */}
        </p>

        {/* Table Selector */}
        <div className="mb-4">
          <label className="block text-md font-semibold text-gray-800 mb-2">Select Table</label>
          <select
            value={selectedTable}
            onChange={handleTableChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">-- Select a table --</option>
            {schema.tables.map((table: any) => (
              <option key={table.name} value={table.name}>
                {table.name}
              </option>
            ))}
          </select>
        </div>

        {/* Column Tables for Selected Tables */}
        {Object.entries(selectedTables).map(([tableName, tableData]) => (
          <div key={tableName} className="mb-6">
            <h3 className="text-md font-semibold text-gray-800 mb-2">{tableName}</h3>
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
                {tableData.columns.map((column: any) => (
                  <tr key={column.name} className="border-b border-gray-200">
                    <td className="p-2 text-sm text-gray-700">
                      {column.name}
                      {!column.isNullable && !column.isIdentity && (
                        <span className="text-blue-600 text-xs ml-2">Not null</span>
                      )}
                      {column.isUnique && !column.isIdentity && (
                        <span className="text-blue-600 text-xs ml-2">Unique</span>
                      )}
                      {column.isIdentity && <span className="text-blue-600 text-xs ml-2">Auto-generated</span>}
                      {column.foreignKey && <span className="text-blue-600 text-xs ml-2">FK</span>}
                    </td>
                    <td className="p-2 text-sm text-gray-700">{column.type}</td>
                    <td className="p-2 text-sm text-gray-700">{column.maxLength / 2}</td>
                    <td className="p-2">
                      {column.isIdentity || column.foreignKey ? (
                        <span className="text-gray-500 text-sm">Not applicable</span>
                      ) : (
                        <button
                          onClick={() => openFakerModal(tableName, column.name)}
                          className={`w-full px-2 py-1 text-left text-sm border rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isSubmitted && !column.isNullable && !tableData.fakerSelections[column.name]
                              ? 'border-red-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {getFakerLabel(tableName, tableData.fakerSelections[column.name])}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Save Button */}
        <div className="flex justify-end">
          {selectedTable && (
            <button
              onClick={handleAutoSelect}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 mr-5"
            >
              <FontAwesomeIcon icon={faMagicWandSparkles} className="w-4 h-4" />
              Try Auto Select
            </button>
          )}
          <button
            onClick={handleCreateScript}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FontAwesomeIcon icon={faCode} className="w-4 h-4" />
            Create Script
          </button>
        </div>
      </div>

      {/* Faker Function Modal */}
      {isFakerModalOpen && activeColumn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Select Faker Function for {activeColumn.columnName}
              </h3>
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
                          onClick={() =>
                            handleFakerChange(activeColumn.tableName, activeColumn.columnName, method.value)
                          }
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
