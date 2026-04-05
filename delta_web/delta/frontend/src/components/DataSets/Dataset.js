import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { downloadDataset, deleteDataset } from "../../actions/datasets";
import { createMessage } from "../../actions/messages";
import { addConversation, getUserConversations } from "../../actions/conversation";
import tag_styles from "../data_transfer/tags.module.css";
import styles from "./Dataset.module.css";
import FileTypeIcon from "./FileTypeIcon";
import axios from "axios";

const Dataset = props => {
    const navigate = useNavigate();
    const canEdit = props.auth.user && props.data && props.auth.user.id === props.data.author;

    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [loadingTable, setLoadingTable] = useState(false);
    const [showTable, setShowTable] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: "", color: "#198754" });


    useEffect(() => {
        if (props.data && props.data.files) {
            setFiles(props.data.files);
            const imageFiles = props.data.files.filter(f => isImageFile(f.file_name));
            if (imageFiles.length > 0) setActiveFile(imageFiles[0]);
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
                if (activeFile && activeFile.id === fileId) {
                    setActiveFile(files.length > 1 ? files[0] : null);
                    setShowTable(false);
                }
                showToast("File deleted successfully", "#198754");
                // Notify parent component
                if (props.onFileDeleted) {
                    props.onFileDeleted(fileId);
                }
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
        loadFileTable(file);
    };

    const loadFileTable = async(file) => {
        setLoadingTable(true);
        try {
            // For image viewer, we just need to set the file as active and show it
            setTableData({ image_url: file.file_path, file_name: file.file_name });
            setShowTable(true);
            showToast("Image loaded successfully", "#198754");
        } catch (e) {
            showToast("Could not load image", "#dc3545");
            setShowTable(false);
        } finally {
            setLoadingTable(false);
        }
    };



    const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];

    const getFileExt = (filename) => filename.split(".").pop().toUpperCase();

    const isImageFile = (filename) => {
        const ext = filename.split(".").pop().toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
    };

    const getImageFiles = () => files.filter(file => isImageFile(file.file_name));

    const getExtBadgeColor = (ext) => {
        const l = ext.toLowerCase();
        if (IMAGE_EXTENSIONS.includes(l)) return { bg: "#e0e7ff", color: "#3730a3" };
        return { bg: "#dee2e6", color: "#495057" };
    };

    // prettier-ignore
    return ( <
            div className = "card m-2 p-3" >
            <
            div className = "d-flex justify-content-between" >
            <
            div >
            <
            p >
            <
            Link to = { `/profile/${props.data.author_username}` } > { props.data.author_username } < /Link> {" "} - {props.data.formatted_date} < /
            p > <
            /div> {
            canEdit && ( <
                div style = {
                    {
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }
                } >
                <
                Link to = { `/datasets/${props.data.id}/edit` }
                className = "btn btn-primary"
                style = {
                    { marginBottom: 0, padding: "6px 12px", fontSize: "14px" }
                } >
                Edit <
                /Link> <
                button onClick = { clickDelete }
                className = "btn btn-danger"
                style = {
                    { marginBottom: 0, padding: "6px 12px", fontSize: "14px" }
                } >
                Delete <
                /button> < /
                div >
            )
        } <
        /div>

    <
    div >
        <
        h4 > Dataset Name: { props.data.name } < /h4> <
    small > Download count: { props.data.download_count } < /small> <
    hr / >
        <
        div > { props.data.description } < /div>

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
            getImageFiles().length > 0 && ( <
                div style = {
                    { marginTop: "18px" }
                } >
                <
                div style = {
                    { fontSize: "12px", fontWeight: 600, color: "#6c757d", marginBottom: "8px", textTransform: "uppercase", letterSpacing: ".04em" }
                } >
                Images({ getImageFiles().length }) <
                /div> {
                getImageFiles().map((file, idx) => {
                        const ext = getFileExt(file.file_name);
                        const badgeColor = getExtBadgeColor(ext);
                        return ( <
                                div key = { idx }
                                onClick = {
                                    () => openFile(file)
                                }
                                style = {
                                    {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        padding: "7px 10px",
                                        background: activeFile && activeFile.id === file.id ? "#e9f0ff" : "#f8f9fa",
                                        border: activeFile && activeFile.id === file.id ? "1px solid #b6c8fb" : "1px solid #e9ecef",
                                        borderRadius: "4px",
                                        marginBottom: "4px",
                                        fontSize: "13px",
                                        color: "#343a40",
                                        cursor: "pointer",
                                        transition: "background .12s, border-color .12s",
                                        userSelect: "none"
                                    }
                                }
                                onMouseEnter = {
                                    (e) => {
                                        if (!(activeFile && activeFile.id === file.id)) {
                                            e.currentTarget.style.background = "#e9f0ff";
                                            e.currentTarget.style.borderColor = "#b6c8fb";
                                        }
                                    }
                                }
                                onMouseLeave = {
                                    (e) => {
                                        if (!(activeFile && activeFile.id === file.id)) {
                                            e.currentTarget.style.background = "#f8f9fa";
                                            e.currentTarget.style.borderColor = "#e9ecef";
                                        }
                                    }
                                } >
                                <
                                FileTypeIcon filename = { file.file_name }
                                width = { 16 }
                                height = { 16 }
                                style = {
                                    { flexShrink: 0 }
                                }
                                /> <
                                span style = {
                                    {
                                        fontSize: "10px",
                                        padding: "2px 6px",
                                        borderRadius: "3px",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                        flexShrink: 0,
                                        background: badgeColor.bg,
                                        color: badgeColor.color
                                    }
                                } > { ext } <
                                /span> <
                                span style = {
                                    { flex: 1 }
                                } > { file.file_name } < /span> {
                                canEdit && ( <
                                    button onClick = {
                                        (e) => {
                                            e.stopPropagation();
                                            deleteFile(file.id);
                                        }
                                    }
                                    style = {
                                        {
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
                                        }
                                    }
                                    onMouseEnter = {
                                        (e) => (e.target.style.background = "#c82333")
                                    }
                                    onMouseLeave = {
                                        (e) => (e.target.style.background = "#dc3545")
                                    } > ✕Delete <
                                    /button>
                                )
                            } <
                            /div>
                    );
                })
        } <
        /div>
)
}

{
    showTable && activeFile && tableData && ( <
        div style = {
            { marginTop: "24px", marginBottom: "24px", textAlign: "center" }
        } >
        <
        img src = { tableData.image_url || `${window.location.origin}/api/files/${activeFile.id}/` }
        alt = { activeFile.file_name }
        style = {
            {
                maxWidth: "100%",
                maxHeight: "600px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                border: "1px solid #e9ecef"
            }
        }
        onError = {
            (e) => {
                e.target.src = "/api/media/" + activeFile.file_path;
            }
        }
        /> <
        p style = {
            { marginTop: "12px", fontSize: "14px", color: "#6c757d" }
        } > { activeFile.file_name } < /p> < /
        div >
    )
} <
/div>

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
<<<<<<< HEAD
  };

  const clickDownload = () => {
    props.downloadDataset(props.data.id);
  };

  const clickContactOwner = async () => {
    const ownerUsername = props.data.author_username;

    try {
      const existing = await props.getUserConversations(ownerUsername);
      if (existing && existing.length > 0) {
        navigate(`/messages/conversations/${existing[0].id}`);
        return;
      }

      const title = `Access request: ${props.data.name}`;
      const res = await props.addConversation({
        author: props.auth.user.id,
        other_user_username: ownerUsername,
        title,
      });

      if (res && res.data && res.data.id) {
        navigate(`/messages/conversations/${res.data.id}`);
        return;
      }
    } catch (err) {
      console.error(err);
    }

    props.createMessage({
      downloadDatasetError:
        "Unable to start conversation. Please try again or contact the owner manually.",
    });
  };

  return (
    <div className="card m-2 p-3">
      <div className="d-flex justify-content-between">
        <div>
          <p>
            <Link to={`/profile/${props.data.author_username}`}>
              {props.data.author_username}
            </Link>
            -{props.data.formatted_date}
          </p>
        </div>
      </div>
      <div>
        <h4>Dataset Name: {props.data.name}</h4>
        <small>Download count: {props.data.download_count}</small>
        <hr />
        <div>{props.data.description}</div>
      </div>
      <div className="mt-3">
        <h6>Tags</h6>
        <div className="mb-2">
          {props.data.tags.map((objTag, index) => (
            <div className={tag_styles.tag_item} key={index}>
              <span className={tag_styles.text}>{objTag.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        {props.auth.user.id === props.data.author ? (
          <div className="d-flex justify-content-between mt-3">
            <div>
              <Link to={`/datasets/${props.data.id}/edit`} className="btn btn-primary me-2">
                Edit
              </Link>
              <button className="btn btn-success" onClick={clickDownload}>
                Download
              </button>
            </div>
            <button onClick={clickDelete} className="btn btn-danger">
              Delete
            </button>
          </div>
        ) : props.data.is_public || props.data.is_public_orgs ? (
          <button className="btn btn-success" onClick={clickDownload}>
            Download
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={clickContactOwner}
          >
            Contact Owner (Request Access)
          </button>
        )}
      </div>
    </div>
  );
=======
/> <
span > { toast.message } < /span> < /
div > <
    /div>
);
>>>>>>> origin/feature/dataset-viewer
};

const mapStateToProps = state => ({ auth: state.auth });

<<<<<<< HEAD
export default connect(mapStateToProps, {
  deleteDataset,
  downloadDataset,
  createMessage,
  addConversation,
  getUserConversations,
})(Dataset);
=======
export default connect(mapStateToProps, { deleteDataset, downloadDataset })(Dataset);
>>>>>>> origin/feature/dataset-viewer
