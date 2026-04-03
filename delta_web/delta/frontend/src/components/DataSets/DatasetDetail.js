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
    const dataCache = useRef({}); // Cache: { datasetId: { data, timestamp } }

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
                    "Download the source files"
                )
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
        )
    );
};

const mapStateToProps = state => ({ auth: state.auth });

export default connect(mapStateToProps, { getDataset, deleteDataset, downloadDataset })(DatasetDetail);