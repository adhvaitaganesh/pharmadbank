import React, { useState, useEffect, useRef, useCallback } from "react";
import FileTypeIcon from "./FileTypeIcon";

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

const getFileType = (fileName) => {
    if (!fileName) return "unknown";
    const ext = fileName.toLowerCase().split('.').pop();
    const typeMap = {
        csv: "csv",
        xlsx: "excel",
        xls: "excel",
        png: "image",
        jpg: "image",
        jpeg: "image",
        gif: "image",
        webp: "image",
        pdf: "pdf",
        txt: "text",
        json: "json",
    };
    return typeMap[ext] || "unknown";
};

const isParsableData = (fileType) => {
    return ["csv", "excel", "json"].includes(fileType);
};

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
        const [successMessage, setSuccessMessage] = useState("");
        const [uploading, setUploading] = useState(false);
        const [loadedFileName, setLoadedFileName] = useState("");
        const [selectedFile, setSelectedFile] = useState(null);
        const [isLoadingFile, setIsLoadingFile] = useState(false);
        const [hasUserSelectedFile, setHasUserSelectedFile] = useState(false);

        const fileInputRef = useRef(null);
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
            setSuccessMessage("");
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
                setSuccessMessage(`✓ Loaded ${parsedData.rows.length} rows from ${file.file_name}`);
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

        // Handle file upload
        const handleFileUpload = (e) => {
            const fileList = e.target.files;
            const file = fileList ? fileList[0] : null;
            if (!file) return;

            const detectedType = getFileType(file.name);

            if (!isParsableData(detectedType)) {
                setError(`Unsupported file type. Please upload CSV, Excel (.xlsx, .xls), or JSON.`);
                return;
            }

            setUploading(true);
            setError("");
            setSuccessMessage("");

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    let parsedData = { headers: [], rows: [] };

                    if (detectedType === "csv") {
                        const text = event.target.result;
                        const df = DataFrame.fromCSV(text);
                        parsedData = { headers: df.getHeaders(), rows: df.getRows() };
                    } else if (detectedType === "excel") {
                        const arrayBuffer = event.target.result;
                        const df = DataFrame.fromExcel(arrayBuffer);
                        parsedData = { headers: df.getHeaders(), rows: df.getRows() };
                    } else if (detectedType === "json") {
                        const json = JSON.parse(event.target.result);
                        const rows = Array.isArray(json) ? json : json.data || [];
                        const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
                        parsedData = { headers: cols, rows };
                    }

                    setData(parsedData.rows);
                    setHeaders(parsedData.headers);
                    setCurrentPage(1);
                    setSearchTerm("");
                    setSortCol("");
                    setLoadedFileName(file.name);
                    setSuccessMessage(`✓ Loaded file: ${file.name} (${parsedData.rows.length} rows)`);

                    if (onDataLoaded) {
                        onDataLoaded(parsedData);
                    }
                } catch (err) {
                    setError(`Error parsing file: ${err.message}`);
                } finally {
                    setUploading(false);
                }
            };

            reader.onerror = () => {
                setError("Error reading file");
                setUploading(false);
            };

            if (detectedType === "excel") {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        };

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

                // File selector section
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
                            style: {
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#6c757d",
                                marginBottom: "12px",
                                textTransform: "uppercase",
                                letterSpacing: ".04em"
                            }
                        },
                        `Tabular Data(${tabularFiles.length})`
                    ),
                    tabularFiles.map((file, idx) => {
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
                                    style: { flex: 1, fontSize: "13px" }
                                },
                                file.file_name
                            ),
                            isLoadingFile && isSelected ? React.createElement(
                                "span", {
                                    style: {
                                        fontSize: "11px",
                                        color: "#3b82f6",
                                        fontWeight: 500
                                    }
                                },
                                "Loading..."
                            ) : null
                        );
                    })
                ) : null,

                // Header with title and controls
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
                            data.length > 0 ? React.createElement(
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
                                `${data.length} rows • ${headers.length} columns`
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
                        }),

                        React.createElement(
                            "button", {
                                onClick: () => (fileInputRef.current && fileInputRef.current.click()),
                                disabled: uploading,
                                style: {
                                    background: uploading ? "#9ca3af" : "#2563eb",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    padding: "8px 14px",
                                    cursor: uploading ? "not-allowed" : "pointer",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    opacity: uploading ? 0.7 : 1
                                }
                            },
                            uploading ? "Uploading..." : "Load File"
                        ),

                        React.createElement("input", {
                            ref: fileInputRef,
                            type: "file",
                            accept: ".csv,.xlsx,.xls,.json",
                            onChange: handleFileUpload,
                            style: { display: "none" }
                        })
                    )
                ),

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

                // Success message
                successMessage ? React.createElement(
                    "div", {
                        style: {
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "12px 16px",
                            borderRadius: 6,
                            marginBottom: 16,
                            fontSize: 13,
                            border: "1px solid #86efac",
                            display: "flex",
                            alignItems: "center",
                            gap: 8
                        }
                    },
                    "✓",
                    successMessage
                ) : null,

                // Stats bar
                React.createElement(
                    "div", {
                        style: {
                            background: "#f8fafc",
                            padding: "12px 16px",
                            borderRadius: 6,
                            marginBottom: 16,
                            fontSize: 12,
                            color: "#64748b",
                            borderLeft: "3px solid #3b82f6"
                        }
                    },
                    paginated.length > 0 ?
                    `Showing ${(currentPage - 1) * rowsPerPage + 1} - ${Math.min(currentPage * rowsPerPage, sorted.length)} of ${sorted.length}${searchTerm ? ` (filtered from ${data.length})` : ""}` :
            data.length > 0 ? "No results match your search" : "No data loaded"
        ),

                // Loaded file info card (styled like Dataset.js image preview)
                data.length > 0 && loadedFileName ? React.createElement(
                    "div", {
                        style: {
                            marginTop: "18px",
                            marginBottom: "18px",
                            paddingTop: "12px",
                            borderTop: "1px solid #e2e8f0"
                        }
                    },
                    React.createElement(
                        "div", {
                            style: {
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#6c757d",
                                marginBottom: "8px",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em"
                            }
                        },
                        "Table Data"
                    ),
                    React.createElement(
                        "div", {
                            style: {
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                padding: "7px 10px",
                                background: "#e9f0ff",
                                border: "1px solid #b6c8fb",
                                borderRadius: "4px",
                                marginBottom: "4px",
                                fontSize: "13px",
                                color: "#343a40"
                            }
                        },
                        React.createElement(FileTypeIcon, {
                            filename: loadedFileName,
                            width: 16,
                            height: 16,
                            style: { flexShrink: 0 }
                        }),
                        React.createElement(
                            "span", {
                                style: {
                                    fontSize: "10px",
                                    padding: "2px 6px",
                                    borderRadius: "3px",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    flexShrink: 0,
                                    background: "#e0e7ff",
                                    color: "#3730a3"
                                }
                            },
                            loadedFileName.split(".").pop().toUpperCase()
                        ),
                        React.createElement(
                            "span", {
                                style: { flex: 1 }
                            },
                            loadedFileName
                        ),
                        React.createElement(
                            "span", {
                                style: {
                                    fontSize: "11px",
                                    color: "#6c757d",
                                    marginLeft: "8px"
                                }
                            },
                            `${data.length} rows • ${headers.length} cols`
                        )
                    )
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

        // Pagination
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
                        React.Fragment,
                        { key: page },
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
        ) : null
    );
};

export default DataPreview;
export { DataFrame };