import React, { useState, useRef } from 'react';
import {
  Shield, Check, X, AlertCircle, FileCheck, Filter, Table, Upload
} from 'lucide-react';
import Papa from 'papaparse';


interface ScrapedData {
  id: string;
  [key: string]: any;
  status: 'pending' | 'approved' | 'rejected';
  issues?: string[];
  scrapedAt: string;
  serperValidation?: {
    isValid: boolean;
    message: string;
  };
}

interface SerperSearchResult {
  organic?: Array<{
    link?: string;
    title?: string;
    snippet?: string;
  }>;
}

interface ParsedRow {
  [key: string]: unknown;
  url?: string;
  title?: string;
  content?: string;
  description?: string;
  text?: string;
}

interface ContentValidation {
  status: 'approved' | 'rejected' | 'pending';
  message: string;
  confidence: number;
}

// Enhanced Serper API validation function
const validateWithSerper = async (row: ParsedRow): Promise<ContentValidation> => {
  const apiKey = import.meta.env.VITE_SERPER_API_KEY;

  if (!apiKey) {
    return { status: 'pending', message: 'Serper API key not configured', confidence: 0 };
  }

  try {
    // Create a search query based on title and content if available
    const searchQuery = [
      row.title,
      row.content,
      row.description,
      row.text
    ].filter(Boolean).join(' ').slice(0, 100); // Take first 100 chars for search

    if (!searchQuery) {
      return {
        status: 'pending',
        message: 'Insufficient content for validation',
        confidence: 0
      };
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 5 // Get top 5 results for better comparison
      })
    });

    if (!response.ok) {
      throw new Error('Failed to validate with Serper API');
    }

    const data = await response.json() as SerperSearchResult;

    if (!data.organic || data.organic.length === 0) {
      return {
        status: 'pending',
        message: 'No search results found for comparison',
        confidence: 0
      };
    }

    // Combine all content fields for comparison
    const rowContent = [
      row.title,
      row.content,
      row.description,
      row.text
    ].filter(Boolean).join(' ').toLowerCase();

    // Compare content with search results
    let relevanceScore = 0;
    let totalKeywords = 0;

    // Extract keywords from search results
    const searchKeywords = new Set<string>();
    data.organic.forEach(result => {
      const text = [result.title, result.snippet].filter(Boolean).join(' ').toLowerCase();
      // Split into words and filter out common words
      const words = text.split(/\W+/).filter(word =>
        word.length > 3 && !['the', 'and', 'that', 'this', 'with', 'from'].includes(word)
      );
      words.forEach(word => searchKeywords.add(word));
    });

    // Calculate relevance score
    totalKeywords = searchKeywords.size;
    searchKeywords.forEach(keyword => {
      if (rowContent.includes(keyword)) {
        relevanceScore++;
      }
    });

    const confidence = totalKeywords > 0 ? (relevanceScore / totalKeywords) : 0;

    // Determine content status based on confidence score
    if (confidence > 0.6) {
      return {
        status: 'approved',
        message: 'Content verified and relevant',
        confidence
      };
    } else if (confidence < 0.5) {
      return {
        status: 'rejected',
        message: 'Content appears irrelevant or insufficient',
        confidence
      };
    } else {
      return {
        status: 'pending',
        message: 'Content needs manual review - moderate relevance',
        confidence
      };
    }

  } catch (error) {
    return {
      status: 'pending',
      message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      confidence: 0
    };
  }
};

function App() {
  const [currentFilter, setCurrentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedItem, setSelectedItem] = useState<ScrapedData | null>(null);
  const [showFullTable, setShowFullTable] = useState(false);
  const [data, setData] = useState<ScrapedData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const filteredData = data.filter(item => {
    if (currentFilter === 'all') return true;
    return item.status === currentFilter;
  });


  const getStatusColor = (status: ScrapedData['status']) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-yellow-600 bg-yellow-50';
    }
  };

  const handleApprove = (id: string) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, status: 'approved' } : item));
  };

  const exportToCSV = (data: ScrapedData[]) => {
    if (data.length === 0) {
      alert('No data available to export.');
      return;
    }
  
    const csvRows: string[] = [];
  
    // Get the headers
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));
  
    // Format each row
    for (const row of data) {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"'); // Escape double quotes
        return `"${escaped}"`; // Wrap in quotes
      });
      csvRows.push(values.join(','));
    }
  
    // Create a Blob from the CSV string
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
  
    // Create a link element and trigger the download
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'scraped_data.csv');
    a.click();
    URL.revokeObjectURL(url); // Clean up
  };

  const handleExportClick = () => {
    // Use the filtered data based on the current filter
    const dataToExport = filteredData; // This already reflects the current filter state
    exportToCSV(dataToExport);
  };

  const handleReject = (id: string) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, status: 'rejected' } : item));
  };

  const validateRow = async (row: ParsedRow): Promise<{ issues: string[]; status: ScrapedData['status'] }> => {
    const issues: string[] = [];
    let status: ScrapedData['status'] = 'pending';

    try {
      const validation = await validateWithSerper(row);
      const confidencePercentage = Math.round(validation.confidence * 100);

      // Set status based on confidence percentage
      if (confidencePercentage > 60) {
        status = 'approved';
      } else if (confidencePercentage < 50) {
        status = 'rejected';
      } else {
        status = 'pending';
      }

      (row as ScrapedData).serperValidation = {
        isValid: confidencePercentage > 60,
        message: `${validation.message} (Confidence: ${confidencePercentage}%)`
      };

      if (status === 'rejected') {
        issues.push(`Content validation failed: ${validation.message} (${confidencePercentage}% confidence)`);
      } else if (status === 'pending') {
        issues.push(`Content needs review: ${validation.message} (${confidencePercentage}% confidence)`);
      }
    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { issues, status };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    setIsValidating(true);

    if (!file) {
      setError('No file selected');
      setIsValidating(false);
      return;
    }

    if (file.type !== 'text/csv') {
      setError('Please upload a CSV file');
      setIsValidating(false);
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      error: (error) => {
        setError(`Error parsing CSV: ${error.message}`);
        setIsValidating(false);
      },
      complete: async (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`);
          setIsValidating(false);
          return;
        }

        if (results.data.length === 0) {
          setError('No valid data found in CSV');
          setIsValidating(false);
          return;
        }

        try {
          const parsedData: ScrapedData[] = [];

          for (const [index, row] of (results.data as ParsedRow[]).entries()) {
            if (Object.values(row).some(value => value && String(value).trim() !== '')) {
              const { issues, status } = await validateRow(row);
              parsedData.push({
                id: String(index + 1),
                ...row as Record<string, unknown>,
                status,
                scrapedAt: new Date().toISOString(),
                issues
              });
            }
          }

          if (parsedData.length === 0) {
            setError('No valid data rows found in CSV');
            setIsValidating(false);
            return;
          }

          const dynamicHeaders = Object.keys(parsedData[0]).filter(
            key => !['id', 'status', 'issues', 'scrapedAt', 'serperValidation'].includes(key)
          );
          setHeaders(dynamicHeaders);
          setData(parsedData);
          setShowFullTable(true);
        } catch (error) {
          setError(`Error validating data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsValidating(false);
        }
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const renderSelectedItem = () => {
    if (!selectedItem) return null;

    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Data Review</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleApprove(selectedItem.id)}
              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 flex gap-1 items-center"
              disabled={selectedItem.serperValidation && !selectedItem.serperValidation.isValid}
            >
              <Check className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => handleReject(selectedItem.id)}
              className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 flex gap-1 items-center"
            >
              <X className="h-4 w-4" /> Reject
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {headers.map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700">{key}</label>
              <p className="mt-1 text-sm text-gray-900 break-words">{selectedItem[key]}</p>
            </div>
          ))}

          {selectedItem.serperValidation && (
            <div className={`mt-4 p-4 rounded-md ${selectedItem.serperValidation.isValid ? 'bg-green-50' : 'bg-red-50'
              }`}>
              <h3 className="text-sm font-medium text-gray-900">Serper API Validation</h3>
              <p className={`mt-1 text-sm ${selectedItem.serperValidation.isValid ? 'text-green-700' : 'text-red-700'
                }`}>
                {selectedItem.serperValidation.message}
              </p>
            </div>
          )}

          {selectedItem.issues && selectedItem.issues.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-900">Potential Issues</h3>
              <ul className="mt-2 space-y-1">
                {selectedItem.issues.map((issue, i) => (
                  <li key={i} className="flex items-center text-red-600 text-sm gap-1">
                    <AlertCircle className="h-4 w-4" /> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t text-sm text-gray-500 flex justify-between">
            <span>Scraped at: {new Date(selectedItem.scrapedAt).toLocaleString()}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedItem.status)}`}>
              {selectedItem.status}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-900">Data Vetting Agent</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Filter className="h-4 w-4" />
                <select
                  className="border rounded-md px-2 py-1"
                  value={currentFilter}
                  onChange={(e) => setCurrentFilter(e.target.value as any)}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>

            </div>
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isValidating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <div className="flex items-center space-x-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="text-lg">Validating data</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Scraped Data ({filteredData.length} items)
                </h2>
                <button
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  onClick={handleExportClick}
                >
                  Export as CSV
                </button>
              </div>
            </div>
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {filteredData.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer ${selectedItem?.id === item.id ? 'bg-gray-50' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title || 'Untitled'}</p>
                      <p className="text-sm text-gray-500 truncate">{item.url || 'No URL'}</p>
                    </div>
                    <div className={`ml-4 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            {selectedItem ? renderSelectedItem() : (
              <div className="p-6 text-center text-gray-500">
                <FileCheck className="h-12 w-12 mx-auto mb-4" />
                <p>Select an item to review</p>
              </div>
            )}
          </div>
        </div>

        {showFullTable && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Table className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-gray-900">Imported CSV Data</h2>
              </div>
              <button
                onClick={() => setShowFullTable(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <div>
                {/* Header */}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      {headers.map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                </table>

                {/* Scrollable Body */}
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.map((item) => (
                        <tr key={item.id}>
                          {headers.map((key) => (
                            <td key={key} className="px-6 py-4 text-sm text-gray-700">
                              {item[key]}
                            </td>
                          ))}
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                item.status
                              )}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(item.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleReject(item.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
