import React, { useState } from "react";
import { connect } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { downloadDataset, deleteDataset } from "../../actions/datasets";
import tag_styles from "../data_transfer/tags.module.css";
import axios from "axios";
import CSVDataViewer from "./CSVDataViewer"; // adjust path if needed

const Dataset = (props) => {
    const navigate = useNavigate();
    const [tableData, setTableData] = useState(null);
    const [loadingTable, setLoadingTable] = useState(false);
    const [showTable, setShowTable] = useState(false);

    const clickDelete = () => {
        const dialog = window.confirm("Would you like to delete this file? There is no going back.");
        if (dialog) {
            props.deleteDataset(props.data.id);
            navigate("/data/download");
        }
    };

    const clickDownload = () => {
        props.downloadDataset(props.data.id);
    };

    const clickViewTable = async() => {
        if (showTable) {
            setShowTable(false);
            return;
        }
        setLoadingTable(true);
        try {
            const res = await axios.get(`/api/dataset_table/${props.data.id}/`, {
                headers: { Authorization: `Token ${props.auth.token}` }
            });
            setTableData(res.data);
            setShowTable(true);
        } catch (e) {
            alert("Could not load table data. Make sure the dataset was uploaded correctly.");
        }
        setLoadingTable(false);
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
        Link to = { `/profile/${props.data.author_username}` } > { props.data.author_username } <
        /Link>{" "} -
        { props.data.formatted_date } <
        /p> <
        /div> <
        /div>

        <
        div >
        <
        h4 > Dataset Name: { props.data.name } < /h4> <
        small > Download count: { props.data.download_count } < /small> <
        hr / >
        <
        div > { props.data.description } < /div> <
        /div>

        <
        div className = "mt-3" >
        <
        h6 > Tags < /h6> <
        div className = "mb-2" > {
            props.data.tags.map((objTag, index) => ( <
                div className = { tag_styles.tag_item }
                key = { index } >
                <
                span className = { tag_styles.text } > { objTag.text } < /span> <
                /div>
            ))
        } <
        /div> <
        /div>

        {
            props.auth.user.id === props.data.author && ( <
                div className = "d-flex justify-content-between mt-3" >
                <
                div >
                <
                Link to = { `/datasets/${props.data.id}/edit` }
                className = "btn btn-primary me-2" >
                Edit <
                /Link> <
                button className = "btn btn-success me-2"
                onClick = { clickDownload } >
                Download source file <
                /button> <
                button className = "btn btn-info"
                onClick = { clickViewTable }
                disabled = { loadingTable } > { loadingTable ? "Loading..." : showTable ? "Hide Table" : "View Data" } <
                /button> <
                /div> <
                button onClick = { clickDelete }
                className = "btn btn-danger" >
                Delete <
                /button> <
                /div>
            )
        }

        { /* TABLE VIEWER — uses your existing CSVDataViewer */ } {
            showTable && tableData && ( <
                CSVDataViewer csvText = ""
                title = { `📊 ${props.data.name}` }
                token = { props.auth.token }
                datasetId = { props.data.id }
                initialData = { tableData } // pass DB data directly
                />
            )
        } <
        /div>
    );
};

const mapStateToProps = (state) => ({
    auth: state.auth,
});

export default connect(mapStateToProps, { deleteDataset, downloadDataset })(Dataset);