import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from "./tags.module.css";
import { FaStar, FaArrowDown } from 'react-icons/fa';
import fileStyles from "./file-badge.module.css";
import FileTypeIcon from "../DataSets/FileTypeIcon";

const DataCard = ({ data, style, isSelected, onCheckboxChange }) => {
    const cardStyle = {
        transition: 'background-color 0.3s, border-color 0.15s, box-shadow 0.15s',
        height: '100%',
        minHeight: '20rem',
        width: '26rem',
        margin: '0.5rem',
        position: 'relative',
        border: isSelected ? '2px solid #1a4fd6' : '1px solid #ddd',
        boxShadow: isSelected ? '0 0 0 2px rgba(26,79,214,0.12)' : 'none',
        ...style,
    };

    const descriptionStyle = {
        height: '6rem',
        overflowY: 'auto',
        paddingRight: '1rem',
    };

    const renderStars = (rating) => {
        var stars = [];
        if (rating === 0) {
            stars = Array.from({ length: 5 }, (_, i) => ( <
                FaStar key = { i }
                color = { i <= rating ? "gold" : "gray" }
                className = "mr-1" / >
            ));
        } else {
            if (rating === 0) {
                stars = [ < FaStar color = { "gray" }
                    className = "mr-1" / >
                ];
            }
            for (let i = 0; i < 5; i++) {
                stars.push( <
                    FaStar key = { i }
                    color = { i <= rating ? "gold" : "gray" }
                    className = "mr-1" / >
                );
            }
        }
        return stars;
    };

    const getFileTypeBadgeClass = (fileType) => {
        if (!fileType) {
            return fileStyles['ext-default'];
        }
        const typeStr = fileType.toLowerCase();
        const typeMap = {
            'csv': fileStyles['ext-csv'],
            'json': fileStyles['ext-json'],
            'xlsx': fileStyles['ext-xlsx'],
            'xls': fileStyles['ext-xlsx'],
            'pdf': fileStyles['ext-pdf'],
            'pptx': fileStyles['ext-pptx'],
            'txt': fileStyles['ext-txt'],
        };
        return typeMap[typeStr] || fileStyles['ext-default'];
    };

    // prettier-ignore
    return ( <
        span style = {
            { textDecoration: 'none', color: 'inherit' } } >
        <
        div className = "card"
        style = { cardStyle }
        data - testid = "data_card-1" >
        <
        div className = "card-body"
        style = {
            { paddingTop: '3rem' } } >
        <
        input type = "checkbox"
        className = { fileStyles.cardCheckbox }
        checked = { isSelected }
        onChange = {
            (e) => {
                e.stopPropagation();
                onCheckboxChange(e);
            }
        }
        onClick = {
            (e) => e.stopPropagation() }
        /> <
        div className = "d-flex justify-content-between align-items-start mb-3" >
        <
        div >
        <
        h5 className = "card-title" > { data.name } < /h5> <
        div className = "d-flex" > { renderStars(data.avg_rating - 1) } < /div> <
        /div> <
        div className = "text-end" >
        <
        Link to = { `/profile/${data.author_username}` } > { data.author_username } < /Link> <
        div className = "text-muted" > { data.formatted_date } < /div> <
        /div> <
        /div> <
        p className = "card-text"
        style = { descriptionStyle } > { data.description } < /p> <
        div className = "row mt-auto" >
        <
        div className = "col-8" >
        <
        strong > Tags: < /strong> <
        div className = "mt-1" > {
            data.tags.map((tag, index) => ( <
                div className = { styles.tag_item }
                key = { index } >
                <
                span className = { styles.text } > { tag.text } < /span> <
                /div>
            ))
        } <
        /div> <
        /div> <
        /div> {
            data.files && data.files.length > 0 && ( <
                div className = { fileStyles.filesSection } >
                <
                strong className = { fileStyles.filesLabel } > Files < /strong> <
                div className = { fileStyles.filesList } > {
                    data.files.map((file, index) => ( <
                        div key = { index }
                        className = { fileStyles.fileItem } >
                        <
                        div style = {
                            { display: 'flex', alignItems: 'center', gap: '4px', flex: 1 } } >
                        <
                        FileTypeIcon filename = { file.file_name }
                        width = { 16 }
                        height = { 16 }
                        /> <
                        span className = { fileStyles.fileName } > { file.file_name } < /span> <
                        /div> <
                        /div>
                    ))
                } <
                /div> <
                /div>
            )
        } <
        div className = "position-absolute bottom-0 end-0 mb-2 me-2 d-flex align-items-center" >
        <
        FaArrowDown className = "text-muted me-2"
        style = {
            { fontSize: '1.5rem' } }
        /> <
        span className = "badge bg-secondary" > { data.download_count } < /span> <
        /div> <
        /div> <
        /div> <
        /span>
    );
};

export default DataCard;