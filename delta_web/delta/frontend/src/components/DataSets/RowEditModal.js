import React, { useState, useEffect } from "react";

/**
 * RowEditModal Component
 * Displays a modal for editing a single row from the table
 * 
 * Props:
 * - isOpen: boolean - whether modal is visible
 * - row: object - the row data to edit (e.g., {name: "John", age: 30})
 * - headers: array - the column names
 * - rowIndex: number - the index of the row in the data array
 * - onSave: function(updatedRow, rowIndex) - callback when user saves
 * - onClose: function() - callback when user cancels
 * - isSaving: boolean - whether save request is in progress
 */
const RowEditModal = ({ isOpen, row = {}, headers = [], rowIndex = 0, onSave, onClose, isSaving = false }) => {
    const [formData, setFormData] = useState({});

    // Initialize form data when row changes
    useEffect(() => {
        if (row && Object.keys(row).length > 0) {
            setFormData({...row });
        }
    }, [row, isOpen]);

    if (!isOpen) return null;

    const handleChange = (header, value) => {
        setFormData(prev => ({
            ...prev,
            [header]: value
        }));
    };

    const handleSave = () => {
        if (onSave) {
            onSave(formData, rowIndex);
        }
    };

    return (
        // Backdrop
        React.createElement("div", {
                style: {
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9998
                },
                onClick: onClose
            },
            // Modal container
            React.createElement("div", {
                    style: {
                        background: "#fff",
                        borderRadius: 12,
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                        maxWidth: 600,
                        width: "90%",
                        maxHeight: "80vh",
                        overflowY: "auto",
                        padding: 32
                    },
                    onClick: (e) => e.stopPropagation()
                },
                // Header
                React.createElement("div", {
                        style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 24,
                            paddingBottom: 16,
                            borderBottom: "1px solid #e2e8f0"
                        }
                    },
                    React.createElement("h2", {
                            style: {
                                margin: 0,
                                fontSize: 20,
                                fontWeight: 700,
                                color: "#1e293b"
                            }
                        },
                        `Edit Row #${rowIndex + 1}`
                    ),
                    React.createElement("button", {
                            type: "button",
                            onClick: onClose,
                            disabled: isSaving,
                            style: {
                                background: "none",
                                border: "none",
                                fontSize: 24,
                                cursor: isSaving ? "not-allowed" : "pointer",
                                color: "#64748b",
                                padding: 0,
                                width: 32,
                                height: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                opacity: isSaving ? 0.5 : 1
                            }
                        },
                        "✕"
                    )
                ),

                // Form fields
                React.createElement("div", {
                        style: {
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 16,
                            marginBottom: 28
                        }
                    },
                    headers.map((header) =>
                        React.createElement("div", {
                                key: header,
                                style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6
                                }
                            },
                            React.createElement("label", {
                                    style: {
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#475569",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.02em"
                                    }
                                },
                                header
                            ),
                            React.createElement("input", {
                                type: "text",
                                value: formData[header] || "",
                                onChange: (e) => handleChange(header, e.target.value),
                                disabled: isSaving,
                                style: {
                                    padding: "10px 12px",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 6,
                                    fontSize: 13,
                                    fontFamily: "inherit",
                                    color: "#1e293b",
                                    background: "#fff",
                                    transition: "border-color 0.2s, box-shadow 0.2s",
                                    opacity: isSaving ? 0.6 : 1,
                                    cursor: isSaving ? "not-allowed" : "text"
                                },
                                onFocus: (e) => {
                                    e.target.style.borderColor = "#3b82f6";
                                    e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                                },
                                onBlur: (e) => {
                                    e.target.style.borderColor = "#e2e8f0";
                                    e.target.style.boxShadow = "none";
                                }
                            })
                        )
                    )
                ),

                // Action buttons
                React.createElement("div", {
                        style: {
                            display: "flex",
                            gap: 12,
                            justifyContent: "flex-end"
                        }
                    },
                    React.createElement("button", {
                            type: "button",
                            onClick: onClose,
                            disabled: isSaving,
                            style: {
                                padding: "10px 20px",
                                border: "1px solid #e2e8f0",
                                borderRadius: 6,
                                background: "#f8fafc",
                                color: "#475569",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isSaving ? "not-allowed" : "pointer",
                                transition: "background 0.15s, color 0.15s",
                                opacity: isSaving ? 0.6 : 1
                            },
                            onMouseEnter: (e) => {
                                if (!isSaving) {
                                    e.target.style.background = "#e2e8f0";
                                }
                            },
                            onMouseLeave: (e) => {
                                e.target.style.background = "#f8fafc";
                            }
                        },
                        "Cancel"
                    ),
                    React.createElement("button", {
                            type: "button",
                            onClick: handleSave,
                            disabled: isSaving,
                            style: {
                                padding: "10px 20px",
                                border: "none",
                                borderRadius: 6,
                                background: "#3b82f6",
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: isSaving ? "not-allowed" : "pointer",
                                transition: "background 0.15s",
                                opacity: isSaving ? 0.7 : 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 8
                            },
                            onMouseEnter: (e) => {
                                if (!isSaving) {
                                    e.target.style.background = "#2563eb";
                                }
                            },
                            onMouseLeave: (e) => {
                                e.target.style.background = "#3b82f6";
                            }
                        },
                        isSaving ? React.createElement("span", { style: { display: "inline-block", width: 14, height: 14, border: "2px solid #fff", borderRadius: "50%", borderTopColor: "transparent", animation: "spin 0.6s linear infinite" } }) : null,
                        isSaving ? "Saving..." : "Save Changes"
                    )
                )
            )
        )
    );
};

export default RowEditModal;