import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from "./tags.module.css";
import { FaStar, FaArrowDown, FaFile, FaFileExcel, FaFilePdf, FaFileImage, FaFileCode } from 'react-icons/fa';

const DataCard = ({ data, style, isSelected = false, onCheckboxChange = null }) => {
    const [isHovered, setIsHovered] = useState(false);
    const cardStyle = { transition: 'all 0.3s ease', height: '20rem', width: '26rem', margin: '0.5rem', position: 'relative', border: isSelected ? '3px solid #1a4fd6' : '1px solid rgba(0,0,0,0.125)', boxShadow: isSelected ? '0 0 0 3px rgba(26, 79, 214, 0.1)' : isHovered ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.06)', cursor: 'pointer', ...style };
    const descriptionStyle = { height: '4rem', overflowY: 'auto', paddingRight: '1rem' };
    const getFileTypeIcon = (fileName) => {
        if (!fileName) return React.createElement(FaFile, { size: 16 });
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = { csv: React.createElement(FaFileExcel, { size: 16, color: "#16a34a" }), xlsx: React.createElement(FaFileExcel, { size: 16, color: "#16a34a" }), xls: React.createElement(FaFileExcel, { size: 16, color: "#16a34a" }), pdf: React.createElement(FaFilePdf, { size: 16, color: "#dc2626" }), png: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), jpg: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), jpeg: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), gif: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), bmp: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), json: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), xml: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), txt: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), log: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), md: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }) };
        return iconMap[ext] || React.createElement(FaFile, { size: 16 });
    };
    const renderStars = (rating) => { const stars = []; for (let i = 0; i < 5; i++) stars.push(React.createElement(FaStar, { key: i, color: i < Math.ceil(rating) ? "gold" : "gray", className: "mr-1" })); return stars; };
    const handleCheckboxClick = (e) => { e.stopPropagation(); if (onCheckboxChange) onCheckboxChange(data.id); };
    const handleKeyDown = (e) => { if (e.key === ' ') { e.preventDefault(); if (onCheckboxChange) onCheckboxChange(data.id); } };

    return React.createElement('span', { style: { textDecoration: 'none', color: 'inherit' } },
        React.createElement('div', { className: 'card', style: cardStyle, onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), onKeyDown: handleKeyDown, tabIndex: 0, role: 'button' },
            onCheckboxChange && React.createElement('input', { type: 'checkbox', checked: isSelected, onChange: handleCheckboxClick, onClick: (e) => e.stopPropagation(), style: { position: 'absolute', left: '12px', top: '12px', width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1a4fd6', zIndex: 10 } }),
            React.createElement('div', { className: 'card-body', style: { display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' } },
                React.createElement('div', { className: 'd-flex justify-content-between align-items-start mb-3', style: { marginLeft: onCheckboxChange ? '28px' : '0' } },
                    React.createElement('div', null,
                        React.createElement('h5', { className: 'card-title' }, data.name),
                        React.createElement('div', { className: 'd-flex' }, renderStars(data.avg_rating - 1))
                    ),
                    React.createElement('div', { className: 'text-end' },
                        React.createElement(Link, { to: `/profile/${data.author_username}` }, data.author_username),
                        React.createElement('div', { className: 'text-muted' }, data.formatted_date)
                    )
                ),
                React.createElement('p', { className: 'card-text', style: descriptionStyle }, data.description),
                data.files && data.files.length > 0 && React.createElement('div', { style: { marginBottom: '12px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', fontSize: '0.85rem' } },
                    React.createElement('strong', { style: { display: 'block', marginBottom: '6px' } }, 'Files:'),
                    data.files.map((file, index) => React.createElement('div', { key: index, style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontFamily: 'monospace' } },
                        getFileTypeIcon(file.file_name),
                        React.createElement('span', null, file.file_name),
                        file.file_type && React.createElement('span', { style: { fontSize: '0.75rem', padding: '2px 6px', backgroundColor: '#e5e7eb', borderRadius: '3px', color: '#374151' } }, file.file_type.toUpperCase())
                    ))
                ),
                React.createElement('div', { style: { flex: 1 } }),
                React.createElement('div', { className: 'd-flex justify-content-between align-items-flex-end' },
                    React.createElement('div', { className: 'flex-grow-1' },
                        React.createElement('strong', null, 'Tags:'),
                        React.createElement('div', { className: 'mt-1' },
                            data.tags.map((tag, index) => React.createElement('div', { className: styles.tag_item, key: index }, React.createElement('span', { className: styles.text }, tag.text)))
                        )
                    ),
                    React.createElement('div', { className: 'd-flex align-items-center ms-3' },
                        React.createElement(FaArrowDown, { className: 'text-muted me-2', style: { fontSize: '1.5rem' } }),
                        React.createElement('span', { className: 'badge bg-secondary' }, data.download_count)
                    )
                )
            )
        )
    );
};

export default DataCard;