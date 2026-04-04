import React, { useState, useEffect, useRef } from "react";
import { connect } from "react-redux";
import { getDataset, deleteDataset, downloadDataset } from "../../actions/datasets";
import { useParams } from "react-router-dom";
import axios from "axios";
import ReviewForm from "./ReviewForm";
import Review from "./Review";
import Dataset from "./Dataset";
import DataPreview from "./DataPreview";
import FileTypeIcon from "./FileTypeIcon";

const DatasetDetail = props => {
    const { id } = useParams();
    const [csvFile, setDataset] = useState(null);
    const [arrReviews, setArrReviews] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState("");
    const [uploadToast, setUploadToast] = useState({ visible: false, message: "", color: "#198754" });
    const dataCache = useRef({}); // Cache: { datasetId: { data, timestamp } }

    const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
    const TABLE_EXTENSIONS = ["csv", "xlsx", "xls", "json"];

    const isImageFile = (filename) => {
        const ext = filename.split(".").pop().toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
    };

    const isTableFile = (filename) => {
        const ext = filename.split(".").pop().toLowerCase();
        return TABLE_EXTENSIONS.includes(ext);
    };

    const getFileType = (filename) => {
        if (isImageFile(filename)) return "image";
        if (isTableFile(filename)) return "table";
        return "other";
    };

    const showUploadToast = (message, color = "#198754") => {
        setUploadToast({ visible: true, message, color });
        setTimeout(() => setUploadToast({ visible: false, message: "", color }), 2800);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === "dragenter" || e.type === "dragover");
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
    };

    const handleFileUpload = (file) => {
        setUploading(true);
        setUploadError("");
        setUploadSuccess("");

        const fileType = getFileType(file.name);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("dataset_id", csvFile.id);

        // Use image upload endpoint for all file types
        axios.post(`/api/datasets/${csvFile.id}/upload/`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Token ${props.auth.token}`
            }
        }).then(() => {
            let message = "";
            if (fileType === "image") {
                message = "Image uploaded successfully.";
            } else if (fileType === "table") {
                message = "Table file uploaded successfully.";
            } else {
                message = "File uploaded successfully.";
            }
            setUploadSuccess(message);
            showUploadToast(message, "#198754");
            // Refresh data to show new file
            retrieveData();
        }).catch(() => {
            setUploadError("Upload failed. Please try again.");
            showUploadToast("Upload failed", "#dc3545");
        }).finally(() => setUploading(false));
    };

    const retrieveData = () => {
        // Check cache - don't refetch if we have fresh data (less than 5 min old)
        if (dataCache.current[id]) {
            const { data, timestamp } = dataCache.current[id];
            const age = Date.now() - timestamp;
            if (age < 5 * 60 * 1000) { // 5 minute cache
                console.log(`Using cached data for dataset ${id}`);
                setDataset(data);
                setArrReviews(data.reviews);
                return;
            }
        }

        console.log(`Fetching fresh data for dataset ${id}`);
        axios.get(`/api/datasets/${id}/`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${props.auth.token}`,
            },
        }).then(res => {
            // Store in cache
            dataCache.current[id] = {
                data: res.data,
                timestamp: Date.now()
            };
            setDataset(res.data);
            setArrReviews(res.data.reviews);
        });
    };

    const downloadFile = () => {
        if (!csvFile || !csvFile.id) {
            console.error('Dataset not loaded or missing ID');
            return;
        }
        console.log('Downloading dataset with ID:', csvFile.id);
        props.downloadDataset(csvFile.id);
    };

    useEffect(() => {
        retrieveData();
    }, []);

    if (!csvFile) return React.createElement("div", null);

    return React.createElement(
        "div", { className: "container my-4" },
        React.createElement(
            "div", { className: "row" },
            React.createElement(
                "div", { className: "col-md-8" },
                React.createElement(Dataset, { data: csvFile, auth: props.auth })
            ),
            React.createElement(
                "div", { className: "col-md-4" },
                React.createElement("h2", null, csvFile.name),
                React.createElement(
                    "div", { className: "rating mb-3" },
                    React.createElement("h5", null, csvFile.avg_rating, " out of 5"),
                    React.createElement(
                        "h6", { className: "text-muted" },
                        csvFile.num_reviews,
                        " reviews"
                    )
                ),
                React.createElement(
                    "div", { className: "file-info mb-3" },
                    React.createElement("h6", null, "Files: "),
                    React.createElement("p", null, csvFile.files.length, " file(s)"),
                    React.createElement(
                        "div", { className: "file-list", style: { maxHeight: "200px", overflowY: "auto" } },
                        React.createElement(
                            "ul", { className: "list-unstyled" },
                            csvFile.files && csvFile.files.length > 0 ? csvFile.files.map((file, index) =>
                                React.createElement(
                                    "li", { key: index, className: "mb-3 p-2", style: { backgroundColor: "#f9fafb", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px" } },
                                    React.createElement(FileTypeIcon, { filename: file.file_name, width: 24, height: 24 }),
                                    React.createElement(
                                        "div", { style: { flex: 1 } },
                                        React.createElement(
                                            "div", { style: { fontWeight: "500", fontSize: "14px" } },
                                            file.file_name
                                        ),
                                        React.createElement(
                                            "small", { style: { color: "#6b7280" } },
                                            file.file_type ? `Type: ${file.file_type}` : ""
                                        )
                                    )
                                )
                            ) : React.createElement(
                                "li", null,
                                React.createElement("em", { className: "text-muted" }, "No files uploaded")
                            )
                        )
                    )
                ),
                React.createElement("hr"),
                React.createElement(
                    "button", { className: "btn btn-success w-100", onClick: downloadFile, disabled: !csvFile },
                    "Download"
                ),
                csvFile && props.auth.user && props.auth.user.id === csvFile.author ? React.createElement(
                    "div", {
                        onDragEnter: handleDrag,
                        onDragOver: handleDrag,
                        onDragLeave: handleDrag,
                        onDrop: handleDrop,
                        style: {
                            border: dragActive ? "2px dashed #7c3aed" : "2px dashed #ccc",
                            borderRadius: 8,
                            padding: 16,
                            marginTop: 16,
                            background: dragActive ? "#f3f4f6" : "#fff",
                            textAlign: "center",
                            transition: "border 0.2s, background 0.2s",
                            cursor: "pointer"
                        }
                    },
                    React.createElement("input", {
                        type: "file",
                        style: { display: "none" },
                        id: "fileUploadInputDetail",
                        onChange: handleFileChange,
                        disabled: uploading
                    }),
                    React.createElement(
                        "label", {
                            htmlFor: "fileUploadInputDetail",
                            style: { cursor: uploading ? "not-allowed" : "pointer", marginBottom: 0 }
                        },
                        React.createElement(
                            "div",
                            null,
                            uploading ? "Uploading..." : dragActive ? "Drop file here" : "Drag & drop files here, or click to select"
                        )
                    ),
                    uploadError && React.createElement(
                        "div", { style: { color: "#dc2626", marginTop: 8, fontSize: "14px" } },
                        uploadError
                    ),
                    uploadSuccess && React.createElement(
                        "div", { style: { color: "#16a34a", marginTop: 8, fontSize: "14px" } },
                        uploadSuccess
                    )
                ) : null
            )
        ),
        React.createElement(
            "div", { className: "row mt-4" },
            React.createElement(
                "div", { className: "col-md-12" },
                React.createElement(DataPreview, {
                    initialData: null,
                    title: "📊 Data Preview",
                    onDataLoaded: null, // Null to prevent redundant /api/datasets/{id}/ calls on file selection
                    files: csvFile && csvFile.files ? csvFile.files : [],
                    datasetId: id,
                    authToken: props.auth.token
                })
            )
        ),
        React.createElement(
            "div", { className: "row mt-4" },
            React.createElement(
                "div", { className: "col-md-12" },
                React.createElement("h3", null, "Reviews"),
                React.createElement(ReviewForm, { csvFileId: id, handleSubmit: retrieveData }),
                React.createElement("hr"),
                React.createElement(
                    "div", { className: "reviews" },
                    arrReviews.map(data =>
                        React.createElement(Review, {
                            key: data.id,
                            reviewData: data,
                            refreshReviews: retrieveData
                        })
                    )
                )
            )
        ),
        React.createElement(
            "div", {
                style: {
                    position: "fixed",
                    bottom: "24px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "#212529",
                    color: "#fff",
                    padding: "9px 18px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: uploadToast.visible ? 1 : 0,
                    pointerEvents: uploadToast.visible ? "auto" : "none",
                    transition: "opacity .2s",
                    zIndex: 9999,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 16px rgba(0,0,0,.2)"
                }
            },
            React.createElement("span", {
                style: {
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: uploadToast.color
                }
            }),
            React.createElement("span", null, uploadToast.message)
        )
    );
};

const mapStateToProps = state => ({ auth: state.auth });

export default connect(mapStateToProps, { getDataset, deleteDataset, downloadDataset })(DatasetDetail);