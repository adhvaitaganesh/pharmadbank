import React, { useState, useEffect } from "react";

const ModernDataViewer = ({ initialData, datasetId, token, title }) => {
        const [data, setData] = useState(initialData ? .rows || []);
        const [searchTerm, setSearchTerm] = useState("");
        const [sortCol, setSortCol] = useState(null);
        const [sortDir, setSortDir] = useState("asc");
        const [currentPage, setCurrentPage] = useState(1);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState(null);

        const headers = initialData ? .headers || [];
        const rowsPerPage = 10;

        // Filter based on search term
        const filtered = data.filter(row =>
            headers.some(header =>
                String(row[header] || "").toLowerCase().includes(searchTerm.toLowerCase())
            )
        );

        // Sort data
        const sorted = [...filtered].sort((a, b) => {
            if (!sortCol) return 0;
            const aVal = a[sortCol] || "";
            const bVal = b[sortCol] || "";
            const comparison = String(aVal).localeCompare(String(bVal));
            return sortDir === "asc" ? comparison : -comparison;
        });

        // Paginate
        const totalPages = Math.ceil(sorted.length / rowsPerPage);
        const startIdx = (currentPage - 1) * rowsPerPage;
        const paginated = sorted.slice(startIdx, startIdx + rowsPerPage);

        const handleSort = (col) => {
            if (sortCol === col) {
                setSortDir(sortDir === "asc" ? "desc" : "asc");
            } else {
                setSortCol(col);
                setSortDir("asc");
            }
        };

        const handlePageChange = (page) => {
            if (page >= 1 && page <= totalPages) {
                setCurrentPage(page);
            }
        };

        const getSortIcon = (col) => {
            if (sortCol !== col) return "";
            return sortDir === "asc" ? " ↑" : " ↓";
        };

        const renderValue = (val) => {
            if (val === null || val === undefined) return "-";
            if (typeof val === "object") return JSON.stringify(val);
            return String(val).substring(0, 100);
        };

        const refreshData = async() => {
            if (!datasetId || !token) return;
            setLoading(true);
            try {
                const res = await fetch(`/api/dataset_table/${datasetId}/`, {
                    headers: {
                        Authorization: `Token ${token}`
                    }
                });
                const result = await res.json();
                if (result.success) {
                    setData(result.rows);
                    setError(null);
                } else {
                    setError(result.error || "Failed to refresh data");
                }
            } catch (err) {
                setError("Error refreshing data: " + err.message);
            } finally {
                setLoading(false);
            }
        };

        const refreshButton = (datasetId && token) ? React.createElement(
            "button", {
                onClick: refreshData,
                disabled: loading,
                className: "refresh-btn",
                title: "Refresh data from database"
            },
            loading ? "⟳ Syncing..." : "↻ Sync"
        ) : null;

        return React.createElement(
                "div", { className: "modern-viewer" },
                // Error alert
                error ? React.createElement(
                    "div", { className: "viewer-error" },
                    React.createElement("span", null, "⚠️ " + error)
                ) : null,

                // Header
                React.createElement(
                    "div", { className: "viewer-header" },
                    React.createElement(
                        "div", { className: "header-left" },
                        React.createElement("h2", { className: "viewer-title" }, title),
                        React.createElement(
                            "div", { className: "stats" },
                            React.createElement("span", { className: "stat-item" }, `${data.length} rows`),
                            React.createElement("span", { className: "stat-divider" }, "•"),
                            React.createElement("span", { className: "stat-item" }, `${headers.length} columns`)
                        )
                    ),

                    // Controls
                    React.createElement(
                        "div", { className: "header-right" },
                        React.createElement("input", {
                            type: "text",
                            placeholder: "🔍 Search all data...",
                            value: searchTerm,
                            onChange: (e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            },
                            className: "search-input"
                        }),
                        refreshButton
                    )
                ),

                // Stats bar
                React.createElement(
                    "div", { className: "viewer-stats" },
                    React.createElement(
                        "span",
                        null,
                        `Showing ${paginated.length > 0 ? startIdx + 1 : 0} - ${Math.min(startIdx + rowsPerPage, sorted.length)} of ${sorted.length}${searchTerm ? ` (filtered from ${data.length})` : ""}`
            )
        ),

        // Table
        React.createElement(
            "div",
            { className: "table-wrapper" },
            React.createElement(
                "table",
                { className: "modern-table" },
                React.createElement(
                    "thead",
                    null,
                    React.createElement(
                        "tr",
                        null,
                        headers.map(header =>
                            React.createElement(
                                "th",
                                {
                                    key: header,
                                    onClick: () => handleSort(header),
                                    className: `sortable ${sortCol === header ? "active" : ""}`
                                },
                                header,
                                getSortIcon(header)
                            )
                        )
                    )
                ),
                React.createElement(
                    "tbody",
                    null,
                    paginated.length > 0 ? paginated.map((row, idx) =>
                        React.createElement(
                            "tr",
                            { key: `${startIdx}-${idx}`, className: idx % 2 === 0 ? "even" : "odd" },
                            headers.map(header =>
                                React.createElement(
                                    "td",
                                    { key: `${header}-${idx}` },
                                    renderValue(row[header])
                                )
                            )
                        )
                    ) : React.createElement(
                        "tr",
                        null,
                        React.createElement(
                            "td",
                            { colSpan: headers.length, className: "empty-state" },
                            "No data to display"
                        )
                    )
                )
            )
        ),

        // Pagination
        React.createElement(
            "div",
            { className: "pagination" },
            React.createElement(
                "button",
                {
                    onClick: () => handlePageChange(currentPage - 1),
                    disabled: currentPage === 1,
                    className: "pagination-btn prev"
                },
                "← Previous"
            ),
            React.createElement(
                "div",
                { className: "pagination-numbers" },
                Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => {
                        const distance = Math.abs(p - currentPage);
                        return distance < 2 || p === 1 || p === totalPages;
                    })
                    .map((page, idx, filtered) => {
                        const prevPage = filtered[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;

                        return React.createElement(
                            React.Fragment,
                            { key: page },
                            showEllipsis ? React.createElement("span", { className: "ellipsis" }, "...") : null,
                            React.createElement(
                                "button",
                                {
                                    onClick: () => handlePageChange(page),
                                    className: `page-btn ${page === currentPage ? "active" : ""}`
                                },
                                page
                            )
                        );
                    })
            ),
            React.createElement(
                "button",
                {
                    onClick: () => handlePageChange(currentPage + 1),
                    disabled: currentPage === totalPages,
                    className: "pagination-btn next"
                },
                "Next →"
            )
        )
    );
};

export default ModernDataViewer;