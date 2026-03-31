import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";

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

    head(n = 5) {
        return new DataFrame(this.data.slice(0, n), this.columns);
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

const parseCSV = (text) => {
    const df = DataFrame.fromCSV(text);
    return { headers: df.getHeaders(), rows: df.getRows() };
};

// Detect file type from file name or extension
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

// Check if file type is parsable as tabular data
const isParsableData = (fileType) => {
    return ["csv", "excel", "json"].includes(fileType);
};

// Check if file type is an image
const isImageType = (fileType) => {
    return ["image"].includes(fileType);
};

const CSVDataViewer = ({ csvText, title = "📊 Data Preview", onDataFrameReady, token, datasetId, initialData, fileName = null }) => {

    // Detect file type from fileName or default to CSV
    const [detectedFileType, setDetectedFileType] = useState(() => {
        return fileName ? getFileType(fileName) : "csv";
    });

    // Use initialData from DB if provided, otherwise parse csvText
    const [parsedData, setParsedData] = useState(() => {
        if (initialData) {
            return { headers: initialData.headers, rows: initialData.rows };
        }
        return parseCSV(csvText || "");
    });

    const [dataFrame, setDataFrame] = useState(() =>
        new DataFrame(parsedData.rows, parsedData.headers)
    );
    const [searchTerm, setSearchTerm] = useState("");
    const [sortCol, setSortCol] = useState("");
    const [sortDir, setSortDir] = useState("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [fileLoaded, setFileLoaded] = useState(!!initialData);
    const [fileType, setFileType] = useState(detectedFileType);
    const [imageUrl, setImageUrl] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [downloadingDB, setDownloadingDB] = useState(false);
    const [dbResponse, setDbResponse] = useState(null);
    const [dbError, setDbError] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState("");
    const [tableName, setTableName] = useState(null);
    const fileInputRef = useRef(null);
    const rowsPerPage = 8;

    const { headers, rows } = parsedData;

    const handleFileUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const detectedType = getFileType(file.name);
        console.log(`File detected: ${file.name}, type: ${detectedType}`);

        // Handle image files separately
        if (isImageType(detectedType)) {
            const reader = new FileReader();
            reader.onload = (event) => {
                console.log("Image loaded successfully");
                setImageUrl(event.target.result);
                setFileType(detectedType);
                setFileLoaded(true);
                setUploadError("");
                setUploadSuccess(`✓ Image loaded: ${file.name}`);
                // Clear data-related state for images
                setParsedData({ headers: [], rows: [] });
                setDataFrame(new DataFrame([], []));
                setTableName(null);
                setDbResponse(null);
            };
            reader.onerror = (error) => {
                console.error("Error loading image:", error);
                setUploadError(`Error loading image: ${error.message}`);
            };
            reader.readAsDataURL(file);
            return;
        }

        // Handle parsable data (CSV, Excel, etc.)
        if (!isParsableData(detectedType)) {
            setUploadError(`File type not supported. Please upload: CSV, Excel (.xlsx, .xls), PNG, JPG, GIF, or other common formats.`);
            return;
        }

        setUploading(true);
        setUploadError("");
        setImageUrl(null); // Clear any previous image

        const formData = new FormData();
        formData.append("file", file);
        if (datasetId) {
            formData.append("dataset_id", datasetId);
        }

        // Prepare headers with authorization token
        const headers = {};
        if (token) {
            headers["Authorization"] = `Token ${token}`;
        }

        // Build URL with dataset_id as query parameter for better tracking
        const parseUrl = datasetId ? `/api/parse_file/?dataset_id=${datasetId}` : "/api/parse_file/";

        // Send file to backend for parsing
        fetch(parseUrl, {
                method: "POST",
                body: formData,
                headers: headers,
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || "Error parsing file");
                    });
                }
                return response.json();
            })
            .then(data => {
                // Update state with parsed data from backend
                const parsedResult = {
                    headers: data.headers || [],
                    rows: data.rows || []
                };
                setParsedData(parsedResult);
                const df = new DataFrame(parsedResult.rows, parsedResult.headers);
                setDataFrame(df);
                setFileType(detectedType);
                setCurrentPage(1);
                setSortCol("");
                setSearchTerm("");
                setFileLoaded(true);
                setUploadError("");
                setImageUrl(null); // Clear image if switching back to tabular data

                // Handle new auto-save response from backend
                if (data.table_name) {
                    setTableName(data.table_name);
                    setUploadSuccess(`✓ File saved to database successfully!\nTable: ${data.table_name}\nRows: ${data.rows_saved}`);
                    setDbResponse({
                        table_name: data.table_name,
                        rows_saved: data.rows_saved,
                        columns: data.headers || data.columns || []
                    });
                }

                if (onDataFrameReady) onDataFrameReady(df);
            })
            .catch(error => {
                console.error("Error uploading file:", error);
                setUploadError(`Error: ${error.message}`);
                setFileLoaded(false);
            })
            .finally(() => {
                setUploading(false);
            });
    };

    const handleDownloadToDatabase = () => {
        if (!datasetId) {
            setDbError("Dataset ID not provided");
            return;
        }

        setDownloadingDB(true);
        setDbError("");
        setDbResponse(null);

        const headers = {};
        if (token) {
            headers["Authorization"] = `Token ${token}`;
        }

        // Call the download endpoint which saves to SQLite
        fetch(`/api/public_datasets/${datasetId}/download/`, {
                method: "GET",
                headers: headers,
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || "Error saving to database");
                    });
                }
                return response.json();
            })
            .then(data => {
                setDbResponse(data);
                setDbError("");
            })
            .catch(error => {
                console.error("Error downloading to database:", error);
                setDbError(`Error: ${error.message}`);
                setDbResponse(null);
            })
            .finally(() => {
                setDownloadingDB(false);
            });
    };

    const handleSort = (col) => {
        setSortCol(col);
        setSortDir(sortDir === "asc" ? "desc" : "asc");
        setCurrentPage(1);
    };

    const isNumeric = (val) => {
        return !isNaN(parseFloat(val)) && isFinite(val);
    };

    const filtered = rows.filter(row => {
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        return headers.some(h => {
            const cellVal = (row[h] || "").toString().toLowerCase();
            return cellVal.includes(lower);
        });
    });

    const sorted = filtered.slice().sort((a, b) => {
        if (!sortCol) return 0;
        const aVal = a[sortCol] || "";
        const bVal = b[sortCol] || "";

        let comparison = 0;
        if (isNumeric(aVal) && isNumeric(bVal)) {
            comparison = parseFloat(aVal) - parseFloat(bVal);
        } else {
            comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDir === "asc" ? comparison : -comparison;
    });

    const totalPages = Math.ceil(sorted.length / rowsPerPage);
    const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const statusColor = (val) => {
        const v = (val || "").toString().toLowerCase();
        if (v === "active") return { bg: "#dcfce7", color: "#166534" };
        if (v === "inactive") return { bg: "#fee2e2", color: "#991b1b" };
        if (v === "pending") return { bg: "#fef9c3", color: "#854d0e" };
        return {};
    };

    return React.createElement(
        "div", {
            style: {
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 24,
                marginBottom: 20
            }
        },
        React.createElement(
            "div", {
                style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                    flexWrap: "wrap",
                    gap: 10
                }
            },
            React.createElement(
                "h3", {
                    style: {
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e293b"
                    }
                },
                title,
                fileLoaded ?
                React.createElement(
                    "span", {
                        style: {
                            fontSize: 11,
                            background: fileType === "excel" ? "#dbeafe" : fileType === "image" ? "#fce7f3" : "#dcfce7",
                            color: fileType === "excel" ? "#1e40af" : fileType === "image" ? "#be185d" : "#166534",
                            borderRadius: 10,
                            padding: "2px 8px",
                            marginLeft: 8,
                            fontWeight: 500
                        }
                    },
                    fileType === "excel" ? "Excel loaded" : fileType === "image" ? "Image loaded" : "CSV loaded"
                ) :
                null
            ),
            React.createElement(
                "div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                React.createElement("input", {
                    placeholder: "Search...",
                    value: searchTerm,
                    onChange: (e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    },
                    style: {
                        border: "1px solid #e2e8f0",
                        borderRadius: 6,
                        padding: "5px 10px",
                        fontSize: 13,
                        width: 160,
                        outline: "none"
                    }
                }),
                React.createElement(
                    "button", {
                        onClick: () => fileInputRef.current.click(),
                        disabled: uploading,
                        style: {
                            background: uploading ? "#9ca3af" : "#2563eb",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: uploading ? "not-allowed" : "pointer",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            opacity: uploading ? 0.6 : 1
                        }
                    },
                    uploading ? "Uploading..." : "Load File"
                ),
                React.createElement("input", {
                    ref: fileInputRef,
                    type: "file",
                    accept: ".csv,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.json",
                    onChange: handleFileUpload,
                    disabled: uploading,
                    style: { display: "none" }
                }),
                fileLoaded && tableName ? React.createElement(
                    "button", {
                        onClick: () => {
                            const dfJson = dataFrame.toJSON();
                            setUploadSuccess(`✓ Data in memory from table: ${tableName}\nRows: ${dfJson.shape[0]} | Columns: ${dfJson.shape[1]}`);
                        },
                        style: {
                            background: "#10b981",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            whiteSpace: "nowrap"
                        }
                    },
                    "✓ Saved to DB"
                ) : fileLoaded && !isImageType(fileType) ? React.createElement(
                    "button", {
                        onClick: () => {
                            const dfJson = dataFrame.toJSON();
                            console.log("DataFrame:", dfJson);
                            alert(`DataFrame loaded:\n${dfJson.shape[0]} rows × ${dfJson.shape[1]} columns\n\nCheck console for full data structure.`);
                        },
                        style: {
                            background: "#10b981",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            whiteSpace: "nowrap"
                        }
                    },
                    "View DataFrame"
                ) : null,
                fileLoaded && datasetId && !isImageType(fileType) ? React.createElement(
                    "button", {
                        onClick: handleDownloadToDatabase,
                        disabled: downloadingDB || tableName,
                        style: {
                            background: tableName ? "#6b7280" : downloadingDB ? "#9ca3af" : "#7c3aed",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: downloadingDB || tableName ? "not-allowed" : "pointer",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            opacity: downloadingDB || tableName ? 0.6 : 1
                        }
                    },
                    tableName ? "Already in DB" : downloadingDB ? "Saving..." : "Save to DB"
                ) : null
            )
        ),
        uploadError ? React.createElement(
            "div", {
                style: {
                    background: "#fee2e2",
                    color: "#991b1b",
                    padding: "12px 16px",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                    border: "1px solid #fecaca"
                }
            },
            uploadError
        ) : null,
        uploadSuccess ? React.createElement(
            "div", {
                style: {
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "12px 16px",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                    border: "1px solid #86efac",
                    whiteSpace: "pre-wrap"
                }
            },
            uploadSuccess
        ) : null,
        dbError ? React.createElement(
            "div", {
                style: {
                    background: "#fee2e2",
                    color: "#991b1b",
                    padding: "12px 16px",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                    border: "1px solid #fecaca"
                }
            },
            dbError
        ) : null,
        dbResponse ? React.createElement(
            "div", {
                style: {
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "12px 16px",
                    borderRadius: 6,
                    marginBottom: 16,
                    fontSize: 13,
                    border: "1px solid #86efac"
                }
            },
            React.createElement(
                "div",
                null,
                React.createElement("strong", null, "✓ Data Saved Successfully"),
                React.createElement("br"),
                "Table: ",
                React.createElement("code", { style: { background: "#f0fdf4", padding: "2px 6px", borderRadius: 3 } }, dbResponse.table_name),
                React.createElement("br"),
                "Rows: ",
                dbResponse.rows_saved,
                " | Columns: ",
                dbResponse.columns.length,
                React.createElement("br"),
                React.createElement(
                    "details", { style: { marginTop: 8, fontSize: 12 } },
                    React.createElement("summary", { style: { cursor: "pointer", fontWeight: 500 } }, "View Columns"),
                    React.createElement(
                        "div", { style: { marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 } },
                        dbResponse.columns.map((col, idx) =>
                            React.createElement(
                                "span", {
                                    key: idx,
                                    style: {
                                        background: "#f0fdf4",
                                        padding: "4px 8px",
                                        borderRadius: 3,
                                        fontSize: 12,
                                        border: "1px solid #bbf7d0"
                                    }
                                },
                                col
                            )
                        )
                    )
                )
            )
        ) : null,
        React.createElement(
            "div", { style: { marginBottom: 12, fontSize: 12, color: "#575757" } },
            isImageType(fileType) && imageUrl ?
            React.createElement("span", null, "Image Preview") :
            isParsableData(fileType) && rows.length > 0 ?
            React.createElement("span", null, rows.length, " rows | ", headers.length, " columns | Showing ", paginated.length, " of ", sorted.length, " filtered") :
            React.createElement("span", null, "No data to display")
        ),
        // Show image preview
        isImageType(fileType) && imageUrl ?
        React.createElement(
            "div", {
                style: {
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 16,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    padding: 16,
                    minHeight: 200,
                    maxHeight: 600
                }
            },
            React.createElement("img", {
                src: imageUrl,
                style: {
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: 6
                },
                alt: "Preview"
            })
        ) :
        // Show data table for parsable formats
        isParsableData(fileType) && rows.length > 0 ?
        React.createElement(
            "div", { style: { overflowX: "auto", marginBottom: 16 } },
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
                        "tr", { style: { borderBottom: "2px solid #e2e8f0", background: "#f8fafc" } },
                        headers.map((header) =>
                            React.createElement(
                                "th", {
                                    key: header,
                                    onClick: () => handleSort(header),
                                    style: {
                                        textAlign: "left",
                                        padding: "8px 12px",
                                        fontWeight: 600,
                                        color: "#335266",
                                        cursor: "pointer",
                                        userSelect: "none",
                                        background: sortCol === header ? "#e0e7ff" : "#f8fafc"
                                    }
                                },
                                header,
                                sortCol === header ?
                                React.createElement(
                                    "span", { style: { marginLeft: 6, fontSize: 10 } },
                                    sortDir === "asc" ? "▲" : "▼"
                                ) :
                                null
                            )
                        )
                    )
                ),
                React.createElement(
                    "tbody",
                    null,
                    paginated.map((row, rowIndex) =>
                        React.createElement(
                            "tr", {
                                key: rowIndex,
                                style: {
                                    borderBottom: "1px solid #e2e8f0",
                                    background: rowIndex % 2 === 0 ? "#f9fafb" : "#fff"
                                }
                            },
                            headers.map((header) => {
                                const cellVal = row[header] || "";
                                const colors = statusColor(cellVal);
                                return React.createElement(
                                    "td", {
                                        key: header,
                                        style: {
                                            padding: "8px 12px",
                                            color: "#1e293b",
                                            background: colors.bg || "inherit",
                                            color: colors.color || "#1e293b",
                                            borderRadius: colors.bg ? 4 : 0,
                                            fontWeight: colors.color ? 500 : 400
                                        }
                                    },
                                    cellVal
                                );
                            })
                        )
                    )
                )
            )
        ) : null,
        isParsableData(fileType) && totalPages > 1 ?
        React.createElement(
            "div", { style: { display: "flex", gap: 6, alignItems: "center", justifyContent: "center" } },
            React.createElement(
                "button", {
                    onClick: () => setCurrentPage(Math.max(1, currentPage - 1)),
                    disabled: currentPage === 1,
                    style: {
                        padding: "4px 8px",
                        fontSize: 11,
                        cursor: currentPage === 1 ? "default" : "pointer",
                        opacity: currentPage === 1 ? 0.5 : 1,
                        border: "1px solid #e2e8f0",
                        borderRadius: 4,
                        background: "#fff"
                    }
                },
                "◀"
            ),
            Array.from({ length: totalPages }, (_, i) =>
                React.createElement(
                    "button", {
                        key: i + 1,
                        onClick: () => setCurrentPage(i + 1),
                        style: {
                            padding: "4px 8px",
                            fontSize: 11,
                            cursor: "pointer",
                            border: "1px solid #e2e8f0",
                            borderRadius: 4,
                            background: currentPage === i + 1 ? "#2563eb" : "#fff",
                            color: currentPage === i + 1 ? "#fff" : "#000",
                            fontWeight: currentPage === i + 1 ? 600 : 400
                        }
                    },
                    i + 1
                )
            ),
            React.createElement(
                "button", {
                    onClick: () => setCurrentPage(Math.min(totalPages, currentPage + 1)),
                    disabled: currentPage === totalPages,
                    style: {
                        padding: "4px 8px",
                        fontSize: 11,
                        cursor: currentPage === totalPages ? "default" : "pointer",
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        border: "1px solid #e2e8f0",
                        borderRadius: 4,
                        background: "#fff"
                    }
                },
                "▶"
            )
        ) :
        null
    );
};

export default CSVDataViewer;
export { DataFrame };