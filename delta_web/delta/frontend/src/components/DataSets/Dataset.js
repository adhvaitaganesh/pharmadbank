import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { downloadDataset, deleteDataset } from "../../actions/datasets";
import tag_styles from "../data_transfer/tags.module.css";
import styles from "./Dataset.module.css";
import FileTypeIcon from "./FileTypeIcon";
import axios from "axios";

const buildTableHTML = (tableData, searchTerm = "") => {
        if (!tableData || !tableData.headers) return null;
        const filteredRows = !searchTerm ? (tableData.rows || []) : (tableData.rows || []).filter(row =>
            tableData.headers.some(h => String(row[h] || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );
        return `<table class="dataTable"><thead><tr><th class="headerCellRowNum">#</th>${tableData.headers.map(h => `<th class="headerCell">${h}</th>`).join('')}</tr></thead><tbody>${filteredRows.map((row, idx) => `<tr class="tableRow"><td class="rowNumberCell">${idx+1}</td>${tableData.headers.map(h => `<td class="dataCell"><span class="dataCellContent">${row[h] || ''}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;
};


const Dataset = props => {
    const navigate = useNavigate();
    const canEdit = props.auth.user && props.data && props.auth.user.id === props.data.author;

    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [loadingTable, setLoadingTable] = useState(false);
    const [showTable, setShowTable] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState("");
    const [toast, setToast] = useState({ visible: false, message: "", color: "#198754" });


    useEffect(() => {
        if (props.data && props.data.files) {
            setFiles(props.data.files);
            if (props.data.files.length > 0) setActiveFile(props.data.files[0]);
        }
    }, [props.data]);

    const showToast = (message, color = "#198754") => {
        setToast({ visible: true, message, color });
        setTimeout(() => setToast({ visible: false, message: "", color }), 2800);
    };

    const clickDelete = () => {
        if (window.confirm("Would you like to delete this file? There is no going back.")) {
            props.deleteDataset(props.data.id);
            navigate("/data/download");
        }
    };

    const deleteFile = (fileId) => {
        if (window.confirm("Delete this file? This cannot be undone.")) {
            axios.delete(`/api/datasets/${props.data.id}/files/${fileId}/`, {
                headers: { Authorization: `Token ${props.auth.token}` }
            }).then(() => {
                setFiles(files.filter(f => f.id !== fileId));
                if (activeFile?.id === fileId) {
                    setActiveFile(files.length > 1 ? files[0] : null);
                    setShowTable(false);
                }
                showToast("File deleted successfully", "#198754");
            }).catch(() => {
                showToast("Failed to delete file", "#dc3545");
            });
        }
    };

    const clickDownload = () => {
        props.downloadDataset(props.data.id);
        showToast("Download started...", "#0d6efd");
    };

    const openFile = (file) => {
        setActiveFile(file);
        setSearchTerm("");
        const previewable = ["csv", "xlsx", "xls"].includes(file.file_name.split(".").pop().toLowerCase());
        if (!previewable) {
            setShowTable(false);
            showToast("This file type cannot be previewed", "#dc3545");
            return;
        }
        loadFileTable(file);
    };

    const loadFileTable = async (file) => {
        setLoadingTable(true);
        try {
            const res = await axios.get(`/api/dataset_table/${props.data.id}/${file.id}/`, {
                headers: { Authorization: `Token ${props.auth.token}` }
            });
            setTableData(res.data);
            setShowTable(true);
            showToast("Table loaded successfully", "#198754");
        } catch (e) {
            showToast("Could not load table data", "#dc3545");
            setShowTable(false);
        } finally {
            setLoadingTable(false);
        }
    };



    const getFileExt = (filename) => filename.split(".").pop().toUpperCase();

    const getExtBadgeColor = (ext) => {
        const l = ext.toLowerCase();
        if (l === "csv") return { bg: "#d1fae5", color: "#065f46" };
        if (l === "xlsx" || l === "xls") return { bg: "#dcfce7", color: "#14532d" };
        return { bg: "#dee2e6", color: "#495057" };
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
        const formData = new FormData();
        formData.append("file", file);
        formData.append("dataset_id", props.data.id);
        axios.post(`/api/datasets/${props.data.id}/upload/`, formData, {
            headers: {
                "Content-Type": "multipart/form-data",
                Authorization: `Token ${props.auth.token}`
            }
        }).then(() => {
            setUploadSuccess("File uploaded successfully.");
            showToast("File uploaded successfully", "#198754");
        }).catch(() => {
            setUploadError("Upload failed. Please try again.");
            showToast("Upload failed", "#dc3545");
        }).finally(() => setUploading(false));
    };


    return ( <
            div className = "card m-2 p-3" >
            <
            div className = "d-flex justify-content-between" >
            <
            div >
            <
            p >
            <
            Link to = { `/profile/${props.data.author_username}` } > { props.data.author_username } < /Link> { " " } - { props.data.formatted_date } < /
            p > <
            /div> < /
            div >

            <
            div >
            <
            h4 > Dataset Name: { props.data.name } < /h4> <
            small > Download count: { props.data.download_count } < /small> <
            hr / >
            <
            div > { props.data.description } < /div>

            {
                canEdit && ( <
                    div onDragEnter = { handleDrag }
                    onDragOver = { handleDrag }
                    onDragLeave = { handleDrag }
                    onDrop = { handleDrop }
                    style = {
                        {
                            border: dragActive ? "2px dashed #7c3aed" : "2px dashed #ccc",
                            borderRadius: 8,
                            padding: 24,
                            marginTop: 16,
                            marginBottom: 16,
                            background: dragActive ? "#f3f4f6" : "#fff",
                            textAlign: "center",
                            transition: "border 0.2s, background 0.2s"
                        }
                    } >
                    <
                    input type = "file"
                    style = {
                        { display: "none" }
                    }
                    id = "fileUploadInput"
                    onChange = { handleFileChange }
                    disabled = { uploading }
                    /> <
                    label htmlFor = "fileUploadInput"
                    style = {
                        { cursor: uploading ? "not-allowed" : "pointer" }
                    } >
                    <
                    div > { uploading ? "Uploading..." : dragActive ? "Drop file here to upload" : "Drag & drop a file here, or click to select" } <
                    /div> < /
                    label > {
                        uploadError && < div style = {
                            { color: "#dc2626", marginTop: 8 }
                        } > { uploadError } < /div>} {
                        uploadSuccess && < div style = {
                            { color: "#16a34a", marginTop: 8 }
                        } > { uploadSuccess } < /div>} < /
                        div >
                    )
                }

                <
                div className = "mt-3" >
                    <
                    h6 > Tags < /h6> <
                div className = "mb-2" > {
                        props.data.tags.map((objTag, index) => ( <
                            div className = { tag_styles.tag_item }
                            key = { index } >
                            <
                            span className = { tag_styles.text } > { objTag.text } < /span> < /
                            div >
                        ))
                    } <
                    /div> < /
                div >

                    {
                        files.length > 0 && (
                            <div style={{marginTop: "18px"}}>
                                <div style={{fontSize: "12px", fontWeight: 600, color: "#6c757d", marginBottom: "8px", textTransform: "uppercase", letterSpacing: ".04em"}}>
                                    Files included
                                </div>
                            {files.map((file, idx) => {
                                    const ext = getFileExt(file.file_name);
                                    const badgeColor = getExtBadgeColor(ext);
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => openFile(file)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                                padding: "7px 10px",
                                                background: "#f8f9fa",
                                                border: "1px solid #e9ecef",
                                                borderRadius: "4px",
                                                marginBottom: "4px",
                                                fontSize: "13px",
                                                color: "#343a40",
                                                cursor: "pointer",
                                                transition: "background .12s, border-color .12s",
                                                userSelect: "none"
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "#e9f0ff";
                                                e.currentTarget.style.borderColor = "#b6c8fb";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = "#f8f9fa";
                                                e.currentTarget.style.borderColor = "#e9ecef";
                                            }}
                                        >
                                            <FileTypeIcon filename={file.file_name} width={16} height={16} style={{flexShrink: 0}} />
                                            <span style={{
                                                fontSize: "10px",
                                                padding: "2px 6px",
                                                borderRadius: "3px",
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                flexShrink: 0,
                                                background: badgeColor.bg,
                                                color: badgeColor.color
                                            }}>{ext}</span>
                                            <span style={{flex: 1}}>{file.file_name}</span>
                                            <span style={{fontSize: "11px", color: "#adb5bd", marginLeft: "auto"}}>
                                                {["csv", "xlsx", "xls"].includes(ext.toLowerCase()) ? "click to preview" : "no preview"}
                                            </span>
                                            {canEdit && (
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteFile(file.id);
                                                }}
                                                style={{
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
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.background = "#c82333"}
                                                    onMouseLeave={(e) => e.target.style.background = "#dc3545"}
                                                >
                                                    ✕ Delete
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                    }
                    {canEdit && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 10px",
                            background: "#f8f9fa",
                            border: "1px solid #e9ecef",
                            borderRadius: "4px",
                            marginTop: "8px",
                            justifyContent: "flex-end"
                        }}>
                            <Link to={`/datasets/${props.data.id}/edit`} className="btn btn-primary me-2" style={{marginBottom: 0}}>
                                Edit
                            </Link>
                            <button onClick={clickDelete} className="btn btn-danger" style={{marginBottom: 0}}>
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            )
        }

                {showTable && activeFile && (
                    <div style={{ marginTop: "24px", marginBottom: "24px" }}>
                        <div style={{
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            borderRadius: "8px",
                            padding: "16px",
                            color: "#fff",
                            marginBottom: "16px"
                        }}>
                            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px"}}>
                                <div style={{display: "flex", alignItems: "center", gap: "10px", flex: 1}}>
                                    <FileTypeIcon filename={activeFile.file_name} width={20} height={20} />
                                    <div>
                                        <div style={{fontWeight: 600, fontSize: "14px"}}>{activeFile.file_name}</div>
                                        <div style={{fontSize: "12px", opacity: 0.9}}>
                                            {tableData?.rows?.length || 0} rows · {tableData?.headers?.length || 0} columns
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div style={{marginBottom: "12px"}}>
                            <input
                                type="text"
                                placeholder="🔍 Search table data..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    borderRadius: "6px",
                                    border: "2px solid #e9ecef",
                                    fontSize: "13px",
                                    fontFamily: "inherit",
                                    transition: "border-color 0.2s",
                                    boxSizing: "border-box"
                                }}
                                onFocus={(e) => e.target.style.borderColor = "#667eea"}
                                onBlur={(e) => e.target.style.borderColor = "#e9ecef"}
                            />
                        </div>

                        <div style={{
                            border: "1px solid #e9ecef",
                            borderRadius: "8px",
                            overflow: "auto",
                            maxHeight: "500px",
                            background: "#f8f9fd",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
                        }}>
                            {searchTerm && !buildTableHTML(tableData, searchTerm).includes("<tr") ? (
                                <div style={{padding: "40px", textAlign: "center", color: "#adb5bd"}}>
                                    <div style={{fontSize: "14px", marginBottom: "8px"}}>No results found for "{searchTerm}"</div>
                                    <div style={{fontSize: "12px"}}>Try a different search term</div>
                                </div>
                            ) : (
                                <div dangerouslySetInnerHTML={{__html: buildTableHTML(tableData, searchTerm)}} />
                            )}
                        </div>
                    </div>
                )}
            </div>

    <
    div style = {
            {
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
                opacity: toast.visible ? 1 : 0,
                pointerEvents: toast.visible ? "auto" : "none",
                transition: "opacity .2s",
                zIndex: 9999,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(0,0,0,.2)"
            }
        } >
        <
        span style = {
            {
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                flexShrink: 0,
                background: toast.color
            }
        }
    /> <
    span > { toast.message } < /span> < /
    div > <
        /div>
);
};

const mapStateToProps = state => ({ auth: state.auth });

export default connect(mapStateToProps, { deleteDataset, downloadDataset })(Dataset);