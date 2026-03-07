import React, { useState, useEffect } from "react";
import { connect } from "react-redux";
import { getDataset, deleteDataset } from "../../actions/datasets";
import { addToCart } from "../../actions/cart";
import { useParams } from "react-router-dom";
import axios from "axios";
import ReviewForm from "./ReviewForm";
import Review from "./Review";
import Dataset from "./Dataset";
import CSVDataViewer from "./CSVDataViewer";

const DatasetDetail = props => {
    const { id } = useParams();
    const [csvFile, setDataset] = useState(null);
    const [arrReviews, setArrReviews] = useState([]);
    const sampleCSV = `id,name,age,city,score,status
1,Alice Müller,34,Berlin,92.5,active
2,Bob Schmidt,27,Munich,78.0,inactive
3,Clara Bauer,45,Hamburg,88.3,active
4,David Keller,31,Frankfurt,65.1,pending
5,Eva Wagner,29,Cologne,95.2,active
6,Felix Braun,52,Stuttgart,71.8,inactive
7,Greta Hoffmann,38,Düsseldorf,83.6,active
8,Hans Richter,41,Leipzig,59.4,pending`;

    const retrieveData = () => {
        axios.get(`/api/datasets/${id}/`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Token ${props.auth.token}`,
            },
        }).then(res => {
            setDataset(res.data);
            setArrReviews(res.data.reviews);
        });
    };

    const addFileToCart = () => {
        props.addToCart({ file_id: id });
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
                React.createElement(Dataset, { data: csvFile })
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
                        "div", { className: "file-list", style: { maxHeight: "150px", overflowY: "auto" } },
                        React.createElement(
                            "ul", { className: "list-unstyled" },
                            csvFile.files.map((file, index) =>
                                React.createElement(
                                    "li", { key: index, className: "mb-2" },
                                    React.createElement("span", null, file.file_name.split(".")[0]),
                                    " ",
                                    React.createElement("small", null, "(" + file.file_name.split(".").pop() + ")")
                                )
                            )
                        )
                    )
                ),
                React.createElement("hr"),
                React.createElement(
                    "button", { className: "btn btn-primary w-100", onClick: addFileToCart },
                    "Add to Cart"
                )
            )
        ),
        React.createElement(
            "div", { className: "row mt-4" },
            React.createElement(
                "div", { className: "col-md-12" },
                React.createElement(CSVDataViewer, { csvText: sampleCSV, title: "📊 Data Preview" })
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

export default connect(mapStateToProps, { getDataset, deleteDataset, addToCart })(DatasetDetail);