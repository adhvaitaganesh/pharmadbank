import React from "react";

/**
 * FileTypeIcon - Returns a file-type-specific SVG icon
 * Usage: <FileTypeIcon filename="data.csv" width={20} height={20} />
 */
const FileTypeIcon = ({ filename, width = 18, height = 18, style = {} }) => {
    if (!filename) return null;

    const ext = filename.split(".").pop().toLowerCase();

    // CSV icon - spreadsheet with data
    if (ext === "csv") {
        return ( <
            svg width = { width }
            height = { height }
            viewBox = "0 0 24 24"
            fill = "none"
            stroke = "currentColor"
            strokeWidth = "2"
            strokeLinecap = "round"
            strokeLinejoin = "round"
            style = {
                { color: "#059669", ...style } } >
            <
            path d = "M12 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10Z" / >
            <
            polyline points = "14 2 14 10 22 10" / >
            <
            line x1 = "8"
            y1 = "15"
            x2 = "16"
            y2 = "15" / >
            <
            line x1 = "8"
            y1 = "19"
            x2 = "16"
            y2 = "19" / >
            <
            /svg>
        );
    }

    // Excel (XLSX/XLS) icon - green spreadsheet
    if (ext === "xlsx" || ext === "xls" || ext === "excel") {
        return ( <
            svg width = { width }
            height = { height }
            viewBox = "0 0 24 24"
            fill = "currentColor"
            style = {
                { color: "#16a34a", ...style } } >
            <
            path d = "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 15H7v-2h2v2zm0-4H7v-2h2v2zm0-4H7V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" / >
            <
            /svg>
        );
    }

    // PDF icon - document with red accent
    if (ext === "pdf") {
        return ( <
            svg width = { width }
            height = { height }
            viewBox = "0 0 24 24"
            fill = "none"
            stroke = "currentColor"
            strokeWidth = "2"
            strokeLinecap = "round"
            strokeLinejoin = "round"
            style = {
                { color: "#dc2626", ...style } } >
            <
            path d = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" / >
            <
            polyline points = "14 2 14 8 20 8" / >
            <
            text x = "9"
            y = "17"
            fontSize = "8"
            fontWeight = "bold"
            textAnchor = "middle" > PDF < /text> <
            /svg>
        );
    }

    // Image icons (PNG, JPG, JPEG, GIF)
    if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "bmp") {
        return ( <
            svg width = { width }
            height = { height }
            viewBox = "0 0 24 24"
            fill = "none"
            stroke = "currentColor"
            strokeWidth = "2"
            strokeLinecap = "round"
            strokeLinejoin = "round"
            style = {
                { color: "#8b5cf6", ...style } } >
            <
            rect x = "3"
            y = "3"
            width = "18"
            height = "18"
            rx = "2"
            ry = "2" / >
            <
            circle cx = "8.5"
            cy = "8.5"
            r = "1.5" / >
            <
            polyline points = "21 15 16 10 5 21" / >
            <
            /svg>
        );
    }

    // JSON icon
    if (ext === "json") {
        return ( <
            svg width = { width }
            height = { height }
            viewBox = "0 0 24 24"
            fill = "none"
            stroke = "currentColor"
            strokeWidth = "2"
            strokeLinecap = "round"
            strokeLinejoin = "round"
            style = {
                { color: "#f59e0b", ...style } } >
            <
            path d = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" / >
            <
            text x = "8"
            y = "15"
            fontSize = "8"
            fontWeight = "bold"
            textAnchor = "middle" > { `{}` } < /text> <
            /svg>
        );
    }

    // Text file icon (TXT, CSV, etc.)
    if (ext === "txt" || ext === "log" || ext === "md") {
        return ( <
            svg width = { width }
            height = { height }
            viewBox = "0 0 24 24"
            fill = "none"
            stroke = "currentColor"
            strokeWidth = "2"
            strokeLinecap = "round"
            strokeLinejoin = "round"
            style = {
                { color: "#6b7280", ...style } } >
            <
            path d = "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" / >
            <
            polyline points = "13 2 13 9 20 9" / >
            <
            line x1 = "8"
            y1 = "13"
            x2 = "16"
            y2 = "13" / >
            <
            line x1 = "8"
            y1 = "17"
            x2 = "12"
            y2 = "17" / >
            <
            /svg>
        );
    }

    // Default file icon (fallback)
    return ( <
        svg width = { width }
        height = { height }
        viewBox = "0 0 24 24"
        fill = "none"
        stroke = "currentColor"
        strokeWidth = "2"
        strokeLinecap = "round"
        strokeLinejoin = "round"
        style = {
            { color: "#6b7280", ...style } } >
        <
        path d = "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" / >
        <
        polyline points = "13 2 13 9 20 9" / >
        <
        /svg>
    );
};

export default FileTypeIcon;