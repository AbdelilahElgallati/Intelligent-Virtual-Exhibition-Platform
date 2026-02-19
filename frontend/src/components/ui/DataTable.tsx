import React from 'react';

interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    onRowClick?: (item: T) => void;
    isLoading?: boolean;
    emptyMessage?: string;
}

export function DataTable<T>({
    columns,
    data,
    onRowClick,
    isLoading,
    emptyMessage = "No data available"
}: DataTableProps<T>) {
    if (isLoading) {
        return (
            <div className="w-full flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-gray-200">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map((column, idx) => (
                            <th
                                key={idx}
                                scope="col"
                                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item, rowIdx) => (
                        <tr
                            key={rowIdx}
                            onClick={() => onRowClick?.(item)}
                            className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                        >
                            {columns.map((column, colIdx) => (
                                <td
                                    key={colIdx}
                                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                    {typeof column.accessor === 'function'
                                        ? column.accessor(item)
                                        : (item[column.accessor] as React.ReactNode)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
