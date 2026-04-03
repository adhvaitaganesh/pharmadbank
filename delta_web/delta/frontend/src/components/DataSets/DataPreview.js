import React, { useState, useEffect, useRef, useCallback } from "react";

// DataFrame class for managing tabular data
class DataFrame {
    constructor(data = [], columns = []) {
        this.data = data;
        this.columns = columns.length > 0 ? columns : (data.length > 0 ? Object.keys(data[0]) : []);
    }

    static fromCSV(text) {
        const lines = text.split("\n").filter(line => line.trim());
        if (lines.length === 0) return new DataFrame();

        const headers = lines[0].split(",").map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const values = line.split(",").map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || "";
            });
            return row;
        });

        return new DataFrame(rows, headers);
    }

    static fromExcel(arrayBuffer) {
        try {
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);
            const columns = data.length > 0 ? Object.keys(data[0]) : [];
            return new DataFrame(data, columns);
        } catch (error) {
            console.error("Error reading Excel file:", error);
            return new DataFrame();
        }
    }

    getHeaders() {
        return this.columns;
    }

    getRows() {
        return this.data;
    }

    shape() {
        return [this.data.length, this.columns.length];
    }

    toJSON() {
        return {
            columns: this.columns,
            data: this.data,
            shape: this.shape()
        };
    }

    toCSV() {
        const headers = this.columns.join(",");
        const rows = this.data.map(row =>
            this.columns.map(col => {
                const val = row[col] || "";
                return String(val).includes(",") ? `"${val}"` : val;
            }).join(",")
        );
        return [headers, ...rows].join("\n");
    }
}


const DataPreview = ({
        title = "📊 Data Preview",
        initialData = null,
        onDataLoaded = null,
        files = [],
        datasetId = null,
        authToken = null
    }) => {
        // State for data management
        const [data, setData] = useState(initialData ? initialData.rows || [] : []);
        const [headers, setHeaders] = useState(initialData ? initialData.headers || [] : []);
        const [searchTerm, setSearchTerm] = useState("");
        const [sortCol, setSortCol] = useState("");
        const [sortDir, setSortDir] = useState("asc");
        const [currentPage, setCurrentPage] = useState(1);
        const [error, setError] = useState("");
        const [loadedFileName, setLoadedFileName] = useState("");
        const [selectedFile, setSelectedFile] = useState(null);
        const [isLoadingFile, setIsLoadingFile] = useState(false);
        const [hasUserSelectedFile, setHasUserSelectedFile] = useState(false);
        const [isTabularCollapsed, setIsTabularCollapsed] = useState(false);
        const [showPopup, setShowPopup] = useState(false);
        const [popupFileName, setPopupFileName] = useState("");
        const [popupRowCount, setPopupRowCount] = useState(0);

        const abortControllerRef = useRef(null);
        const rowsPerPage = 10;

        // Helper function to get file extension
        const getFileExt = (filename) => filename.split(".").pop().toUpperCase();

        // Helper function to check if file is tabular
        const isTabularFile = (filename) => {
            const ext = filename.split(".").pop().toLowerCase();
            return ["csv", "xlsx", "xls", "json"].includes(ext);
        };

        // Get tabular files
        const tabularFiles = files && Array.isArray(files) ? files.filter(f => isTabularFile(f.file_name)) : [];

        // Load file from backend (memoized to prevent multiple calls)
        const loadFileFromBackend = useCallback(async(file) => {
            // Cancel any previous in-flight request
            if (abortControllerRef.current) {
                console.log(`[ABORT] Cancelling previous request`);
                abortControllerRef.current.abort();
            }

            if (!datasetId) {
                setError("Dataset ID not available");
                return;
            }

            // Create new AbortController for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            console.log(`=== START LOADING FILE ${file.id}: ${file.file_name} ===`);

            setSelectedFile(file);
            setIsLoadingFile(true);
            setError("");
            try {
                const ext = file.file_name.split(".").pop().toLowerCase();
                const fileUrl = `${window.location.origin}/api/dataset_table/${datasetId}/${file.id}/`;

                console.log(`[${file.id}] Fetching from: ${fileUrl}`);

                const headers = {};
                if (authToken) {
                    headers["Authorization"] = `Token ${authToken}`;
                }

                const response = await fetch(fileUrl, {
                    headers,
                    signal: abortController.signal
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch file`);

                let parsedData = { headers: [], rows: [] };
                const responseText = await response.text();
                console.log(`[${file.id}] Response length: ${responseText.length} characters`);
                console.log(`[${file.id}] First 300 chars: ${responseText.substring(0, 300)}`);

                // Detect actual response format (JSON or CSV) by looking at content
                const isJSON = responseText.trim().startsWith("{") || responseText.trim().startsWith("[");

                if (isJSON) {
                    // Parse as JSON - backend may return structured format
                    const json = JSON.parse(responseText);

                    // Handle backend response format: { success, headers, rows }
                    if (json.headers && json.rows) {
                        parsedData = { headers: json.headers, rows: json.rows };
                    } else {
                        // Handle plain JSON array or object with data
                        const rows = Array.isArray(json) ? json : json.rows || json.data || [];
                        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
                        parsedData = { headers, rows };
                    }
                } else {
                    // Parse as CSV
                    const lines = responseText.split("\n").filter(line => line.trim());
                    if (lines.length > 0) {
                        const headers = lines[0].split(",").map(h => h.trim());
                        const rows = lines.slice(1).map(line => {
                            const values = line.split(",").map(v => v.trim());
                            const row = {};
                            headers.forEach((header, index) => {
                                row[header] = values[index] || "";
                            });
                            return row;
                        });
                        parsedData = { headers, rows };
                    }
                }

                console.log(`[${file.id}] Parsed: ${parsedData.rows.length} rows, ${parsedData.headers.length} columns`);

                setData(parsedData.rows);
                setHeaders(parsedData.headers);
                setCurrentPage(1);
                setLoadedFileName(file.file_name);
                setPopupFileName(file.file_name);
                setPopupRowCount(parsedData.rows.length);
                setShowPopup(true);
                setTimeout(() => setShowPopup(false), 3000);
                setHasUserSelectedFile(true);

                if (onDataLoaded) {
                    onDataLoaded(parsedData);
                }
                console.log(`=== END LOADING FILE ${file.id} ===`);
            } catch (e) {
                if (e.name === 'AbortError') {
                    console.log(`[${file.id}] Request was cancelled`);
                } else {
                    console.error(`[${file.id}] Error: ${e.message}`);
                    setError(`Failed to load file: ${e.message}`);
                    setSelectedFile(null);
                }
            } finally {
                setIsLoadingFile(false);
            }
        }, [datasetId, authToken, onDataLoaded]);

        // Update data when initialData changes (from parent component)
        // But skip if user has manually selected a file from the selector
        useEffect(() => {
            if (hasUserSelectedFile) return;
            if (initialData && initialData.rows) {
                setData(initialData.rows);
                setHeaders(initialData.headers || []);
                setCurrentPage(1);
            }
        }, [initialData, hasUserSelectedFile]);

        // Cleanup: cancel any pending requests when component unmounts
        useEffect(() => {
            return () => {
                if (abortControllerRef.current) {
                    abortControllerRef.current.abort();
                }
            };
        }, []);

        // Search and filter
        const filtered = data.filter(row => {
            if (!searchTerm) return true;
            const lower = searchTerm.toLowerCase();
            return headers.some(h => {
                const cellVal = (row[h] || "").toString().toLowerCase();
                return cellVal.includes(lower);
            });
        });

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            if (!sortCol) return 0;
            const aVal = a[sortCol] || "";
            const bVal = b[sortCol] || "";

            let comparison = 0;
            const isNumericA = !isNaN(parseFloat(aVal)) && isFinite(aVal);
            const isNumericB = !isNaN(parseFloat(bVal)) && isFinite(bVal);

            if (isNumericA && isNumericB) {
                comparison = parseFloat(aVal) - parseFloat(bVal);
            } else {
                comparison = String(aVal).localeCompare(String(bVal));
            }

            return sortDir === "asc" ? comparison : -comparison;
        });

        // Paginate
        const totalPages = Math.ceil(sorted.length / rowsPerPage);
        const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

        const handleSort = (col) => {
            if (sortCol === col) {
                setSortDir(sortDir === "asc" ? "desc" : "asc");
            } else {
                setSortCol(col);
                setSortDir("asc");
            }
            setCurrentPage(1);
        };

        const handlePageChange = (page) => {
            if (page >= 1 && page <= totalPages) {
                setCurrentPage(page);
            }
        };

        // Delete file handler
        const deleteTabularFile = (file) => {
            if (window.confirm(`Delete "${file.file_name}"? This cannot be undone.`)) {
                if (!file.id || !datasetId) {
                    setError("Cannot delete: File ID or Dataset ID missing");
                    return;
                }

                const deleteUrl = `/api/datasets/${datasetId}/files/${file.id}/`;
                const headers = {};
                if (authToken) {
                    headers["Authorization"] = `Token ${authToken}`;
                }

                fetch(deleteUrl, {
                    method: 'DELETE',
                    headers
                }).then(response => {
                    if (response.status === 204 || response.ok) {
                        // Clear data if this file was selected
                        if (selectedFile && selectedFile.id === file.id) {
                            setData([]);
                            setHeaders([]);
                            setSelectedFile(null);
                            setLoadedFileName("");
                        }
                        setError("");

                        // Trigger a refresh by removing the file from the list
                        // The parent component should re-fetch the file list
                        if (onDataLoaded) {
                            setTimeout(() => {
                                onDataLoaded({ rows: [], headers: [] });
                            }, 500);
                        }
                    } else {
                        response.json().then(data => {
                            setError(`Failed to delete file: ${data.error || 'Unknown error'}`);
                        }).catch(() => {
                            setError(`Failed to delete file (HTTP ${response.status})`);
                        });
                    }
                }).catch(err => {
                    console.error('Error deleting file:', err);
                    setError(`Error deleting file: ${err.message}`);
                });
            }
        };

        // Render with Modern Styling
        return React.createElement(
                "div", {
                    style: {
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 12,
                        padding: 24,
                        marginBottom: 20,
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
                    }
                },

                // Header with title and controls (MOVED TO TOP)
                React.createElement(
                    "div", {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 20,
                            flexWrap: "wrap",
                            gap: 12
                        }
                    },
                    React.createElement(
                        "div",
                        null,
                        React.createElement(
                            "h3", {
                                style: {
                                    margin: 0,
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: "#1e293b"
                                }
                            },
                            title,
                            loadedFileName ? React.createElement(
                                "span", {
                                    style: {
                                        fontSize: 12,
                                        background: "#dbeafe",
                                        color: "#1e40af",
                                        borderRadius: 6,
                                        padding: "3px 10px",
                                        marginLeft: 10,
                                        fontWeight: 500
                                    }
                                },
                                loadedFileName
                            ) : null
                        )
                    ),

                    React.createElement(
                        "div", {
                            style: {
                                display: "flex",
                                gap: 8,
                                alignItems: "center",
                                flexWrap: "wrap"
                            }
                        },
                        React.createElement("input", {
                            type: "text",
                            placeholder: "🔍 Search...",
                            value: searchTerm,
                            onChange: (e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            },
                            style: {
                                border: "1px solid #e2e8f0",
                                borderRadius: 6,
                                padding: "8px 12px",
                                fontSize: 13,
                                minWidth: 150,
                                outline: "none"
                            }
                        })
                    )
                ),

                // File selector section - Collapsible (MOVED BELOW HEADER)
                tabularFiles.length > 0 ? React.createElement(
                    "div", {
                        style: {
                            marginBottom: "24px",
                            paddingBottom: "20px",
                            borderBottom: "1px solid #e2e8f0"
                        }
                    },
                    React.createElement(
                        "div", {
                            onClick: () => setIsTabularCollapsed(!isTabularCollapsed),
                            style: {
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#6c757d",
                                marginBottom: "12px",
                                textTransform: "uppercase",
                                letterSpacing: ".04em",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                userSelect: "none"
                            }
                        },
                        React.createElement(
                            "span", {
                                style: {
                                    display: "inline-block",
                                    transition: "transform 0.2s",
                                    transform: isTabularCollapsed ? "rotate(-90deg)" : "rotate(0deg)"
                                }
                            },
                            "▼"
                        ),
                        `Tabular Data (${tabularFiles.length})`
                    ), !isTabularCollapsed ? tabularFiles.map((file, idx) => {
                        const ext = getFileExt(file.file_name);
                        const isSelected = selectedFile && selectedFile.id === file.id;
                        return React.createElement(
                            "div", {
                                key: idx,
                                onClick: () => loadFileFromBackend(file),
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "8px 12px",
                                    background: isSelected ? "#e9f0ff" : "#f8f9fa",
                                    border: isSelected ? "1px solid #b6c8fb" : "1px solid #e9ecef",
                                    borderRadius: "4px",
                                    marginBottom: "6px",
                                    fontSize: "13px",
                                    color: "#343a40",
                                    cursor: isLoadingFile ? "not-allowed" : "pointer",
                                    transition: "background .12s, border-color .12s",
                                    userSelect: "none",
                                    opacity: isLoadingFile ? 0.7 : 1
                                },
                                onMouseEnter: (e) => {
                                    if (!isSelected && !isLoadingFile) {
                                        e.currentTarget.style.background = "#e9f0ff";
                                        e.currentTarget.style.borderColor = "#b6c8fb";
                                    }
                                },
                                onMouseLeave: (e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = "#f8f9fa";
                                        e.currentTarget.style.borderColor = "#e9ecef";
                                    }
                                }
                            },
                            React.createElement(
                                "span", {
                                    style: {
                                        fontSize: "11px",
                                        padding: "3px 6px",
                                        borderRadius: "3px",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        flexShrink: 0,
                                        background: "#dbeafe",
                                        color: "#1e40af"
                                    }
                                },
                                ext
                            ),
                            React.createElement(
                                "span", {
                                    style: { fontSize: "13px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }
                                },
                                file.file_name
                            ),
                            isLoadingFile && isSelected ? React.createElement(
                                "span", {
                                    style: {
                                        fontSize: "11px",
                                        color: "#3b82f6",
                                        fontWeight: 500,
                                        marginLeft: "8px"
                                    }
                                },
                                "Loading..."
                            ) : null,
                            React.createElement(
                                "div", {
                                    style: {
                                        marginLeft: "auto",
                                        zIndex: 10,
                                        display: "flex"
                                    },
                                    onClick: (e) => e.stopPropagation()
                                },
                                React.createElement(
                                    "button", {
                                        type: "button",
                                        style: {
                                            marginLeft: "8px",
                                            padding: "2px 8px",
                                            fontSize: "11px",
                                            border: "none",
                                            borderRadius: "3px",
                                            background: "#dc3545",
                                            color: "#fff",
                                            cursor: "pointer",
                                            fontWeight: 500,
                                            transition: "background 0.15s"
                                        },
                                        onMouseEnter: (e) => {
                                            e.target.style.background = "#c82333";
                                        },
                                        onMouseLeave: (e) => {
                                            e.target.style.background = "#dc3545";
                                        },
                                        onClick: (e) => {
                                            e.stopPropagation();
                                            deleteTabularFile(file);
                                        }
                                    },
                                    "✕Delete"
                                )
                            )
                        );
                    }) : null
                ) : null,

                // Error message
                error ? React.createElement(
                    "div", {
                        style: {
                            background: "#fee2e2",
                            color: "#991b1b",
                            padding: "12px 16px",
                            borderRadius: 6,
                            marginBottom: 16,
                            fontSize: 13,
                            border: "1px solid #fecaca",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                        }
                    },
                    "⚠️",
                    error
                ) : null,

                // Popup notification for file loaded
                showPopup ? React.createElement(
                    "div", {
                        style: {
                            position: "fixed",
                            top: 20,
                            right: 20,
                            background: "#10b981",
                            color: "#fff",
                            padding: "16px 24px",
                            borderRadius: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            zIndex: 9999,
                            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                            animation: "slideIn 0.3s ease-out"
                        }
                    },
                    `✓ Loaded ${popupRowCount} rows from ${popupFileName}`
                ) : null,

                // Table
                data.length > 0 ? React.createElement(
                    "div", {
                        style: {
                            overflowX: "auto",
                            marginBottom: 16,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0"
                        }
                    },
                    React.createElement(
                        "table", {
                            style: {
                                width: "100%",
                                borderCollapse: "collapse",
                                fontSize: 13
                            }
                        },
                        React.createElement(
                            "thead",
                            null,
                            React.createElement(
                                "tr", {
                                    style: {
                                        background: "#f8fafc",
                                        borderBottom: "2px solid #e2e8f0"
                                    }
                                },
                                headers.map((header) =>
                                    React.createElement(
                                        "th", {
                                            key: header,
                                            onClick: () => handleSort(header),
                                            style: {
                                                textAlign: "left",
                                                padding: "12px 16px",
                                                fontWeight: 600,
                                                color: "#475569",
                                                cursor: "pointer",
                                                userSelect: "none",
                                                background: sortCol === header ? "#e0e7ff" : "#f8fafc",
                                                transition: "background 0.2s"
                                            }
                                        },
                                        header,
                                        sortCol === header ? React.createElement(
                                            "span", {
                                                style: {
                                                    marginLeft: 6,
                                                    fontSize: 11,
                                                    color: "#3b82f6"
                                                }
                                            },
                                            sortDir === "asc" ? " ▲" : " ▼"
                                        ) : null
                                    )
                                )
                            )
                        ),
                        React.createElement(
                            "tbody",
                            null,
                            paginated.map((row, rowIdx) =>
                                React.createElement(
                                    "tr", {
                                        key: rowIdx,
                                        style: {
                                            borderBottom: "1px solid #f1f5f9",
                                            background: rowIdx % 2 === 0 ? "#f9fafb" : "#fff",
                                            transition: "background 0.2s"
                                        }
                                    },
                                    headers.map((header) =>
                                        React.createElement(
                                            "td", {
                                                key: `${rowIdx}-${header}`,
                                                style: {
                                                    padding: "12px 16px",
                                                    color: "#334155",
                                                    maxWidth: 300,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                },
                                                title: String(row[header] || "")
                                            },
                                            row[header] || "-"
                                        )
                                    )
                                )
                            )
                        )
                    )
                ) : null,

                // Pagination (back after table)
                totalPages > 1 ? React.createElement(
                    "div", {
                        style: {
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            gap: 6,
                            paddingTop: 12,
                            borderTop: "1px solid #e2e8f0"
                        }
                    },
                    React.createElement(
                        "button", {
                            onClick: () => handlePageChange(currentPage - 1),
                            disabled: currentPage === 1,
                            style: {
                                padding: "6px 10px",
                                border: "1px solid #e2e8f0",
                                background: currentPage === 1 ? "#f3f4f6" : "#fff",
                                borderRadius: 4,
                                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                opacity: currentPage === 1 ? 0.5 : 1,
                                fontSize: 12
                            }
                        },
                        "◀ Prev"
                    ),

                    Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                        const dist = Math.abs(p - currentPage);
                        return dist < 2 || p === 1 || p === totalPages;
                    })
                    .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return React.createElement(
                            React.Fragment, { key: page },
                            showEllipsis ? React.createElement("span", { style: { opacity: 0.5, fontSize: 12 } }, "...") : null,
                            React.createElement(
                                "button", {
                                    onClick: () => handlePageChange(page),
                                    style: {
                                        minWidth: 32,
                                        padding: "6px 8px",
                                        border: page === currentPage ? "1px solid #3b82f6" : "1px solid #e2e8f0",
                                        background: page === currentPage ? "#3b82f6" : "#fff",
                                        color: page === currentPage ? "#fff" : "#334155",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 12,
                                        fontWeight: page === currentPage ? 600 : 400
                                    }
                                },
                                page
                            )
                        );
                    }),

                    React.createElement(
                        "button", {
                            onClick: () => handlePageChange(currentPage + 1),
                            disabled: currentPage === totalPages,
                            style: {
                                padding: "6px 10px",
                                border: "1px solid #e2e8f0",
                                background: currentPage === totalPages ? "#f3f4f6" : "#fff",
                                borderRadius: 4,
                                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                opacity: currentPage === totalPages ? 0.5 : 1,
                                fontSize: 12
                            }
                        },
                        "Next ▶"
                    )
                ) : null,

                // Stats bar at bottom
                data.length > 0 ? React.createElement(
                    "div", {
                        style: {
                            padding: "4px 0",
                            marginTop: 8,
                            fontSize: 11,
                            color: "#64748b",
                            textAlign: "center"
                        }
                    },
                    paginated.length > 0 ?
                    `Showing ${(currentPage - 1) * rowsPerPage + 1} - ${Math.min(currentPage * rowsPerPage, sorted.length)} of ${sorted.length}${searchTerm ? ` (filtered from ${data.length})` : ""}` :
        data.length > 0 ? "No results match your search" : "No data loaded"
        ) : null
    );
};

export default DataPreview;
export { DataFrame };