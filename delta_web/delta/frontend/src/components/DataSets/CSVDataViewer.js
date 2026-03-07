import React, { useState, useRef } from "react";

const parseCSV = (text) => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || "";
        });
        return row;
    });

    return { headers, rows };
};

const CSVDataViewer = ({ csvText, title = "📊 Data Preview" }) => {
    const [parsedData, setParsedData] = useState(() => parseCSV(csvText));
    const [searchTerm, setSearchTerm] = useState("");
    const [sortCol, setSortCol] = useState("");
    const [sortDir, setSortDir] = useState("asc");
    const [currentPage, setCurrentPage] = useState(1);
    const [fileLoaded, setFileLoaded] = useState(false);
    const fileInputRef = useRef(null);
    const rowsPerPage = 8;

    const { headers, rows } = parsedData;

    const handleFileUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target.result;
            setParsedData(parseCSV(csvText));
            setCurrentPage(1);
            setSortCol("");
            setSearchTerm("");
            setFileLoaded(true);
        };
        reader.readAsText(file);
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
                            background: "#dcfce7",
                            color: "#166534",
                            borderRadius: 10,
                            padding: "2px 8px",
                            marginLeft: 8,
                            fontWeight: 500
                        }
                    },
                    "CSV loaded"
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
                        style: {
                            background: "#2563eb",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontSize: 13,
                            whiteSpace: "nowrap"
                        }
                    },
                    "Load CSV"
                ),
                React.createElement("input", {
                    ref: fileInputRef,
                    type: "file",
                    accept: ".csv",
                    onChange: handleFileUpload,
                    style: { display: "none" }
                })
            )
        ),
        React.createElement(
            "div", { style: { marginBottom: 12, fontSize: 12, color: "#575757" } },
            rows.length,
            " rows | ",
            headers.length,
            " columns | Showing ",
            paginated.length,
            " of ",
            sorted.length,
            " filtered"
        ),
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
        ),
        totalPages > 1 ?
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