import React from 'react';
import { Link } from 'react-router-dom';
import styles from "./tags.module.css";
import { FaStar, FaArrowDown, FaFile, FaFileExcel, FaFilePdf, FaFileImage, FaFileCode } from 'react-icons/fa';

const DataCard = ({ data, style, isSelected = false, onCheckboxChange = null }) => {
    const descriptionStyle = { height: '3rem', overflowY: 'auto', paddingRight: '0.5rem', fontSize: '0.9rem' };
    const cardStyle = { height: '20rem', width: '26rem', margin: '0.5rem', position: 'relative', border: isSelected ? '3px solid #1a4fd6' : '1px solid rgba(0,0,0,0.125)', boxShadow: isSelected ? '0 0 0 3px rgba(26, 79, 214, 0.1)' : '0 2px 4px rgba(0,0,0,0.06)', cursor: 'pointer', ...style };
    const getFileTypeIcon = (fileName) => {
        if (!fileName) return React.createElement(FaFile, { size: 16 });
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = { csv: React.createElement(FaFileExcel, { size: 16, color: "#16a34a" }), xlsx: React.createElement(FaFileExcel, { size: 16, color: "#16a34a" }), xls: React.createElement(FaFileExcel, { size: 16, color: "#16a34a" }), pdf: React.createElement(FaFilePdf, { size: 16, color: "#dc2626" }), png: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), jpg: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), jpeg: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), gif: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), bmp: React.createElement(FaFileImage, { size: 16, color: "#8b5cf6" }), json: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), xml: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), txt: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), log: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }), md: React.createElement(FaFileCode, { size: 16, color: "#6b7280" }) };
        return iconMap[ext] || React.createElement(FaFile, { size: 16 });
    };
    const renderStars = (rating) => { const stars = []; for (let i = 0; i < 5; i++) stars.push(React.createElement(FaStar, { key: i, color: i < Math.ceil(rating) ? "gold" : "gray", className: "mr-1" })); return stars; };
    const handleCheckboxClick = (e) => { e.stopPropagation(); if (onCheckboxChange) onCheckboxChange(data.id); };
    const handleKeyDown = (e) => { if (e.key === ' ') { e.preventDefault(); if (onCheckboxChange) onCheckboxChange(data.id); } };

<<<<<<< HEAD
  const descriptionStyle = {
    height: '6rem',
    overflowY: 'auto',
    paddingRight: '1rem',
  };

  const renderStars = (rating) => {
    var stars = [];
    if (rating === 0) {
      stars = Array.from({ length: 5 }, (_, i) => (
        <FaStar
          key={i}
          color={i <= rating ? "gold" : "gray"}
          className="mr-1"
        />
      ));
    } else {
      if (rating === 0) {
        // not rated yet
        stars = [<FaStar color={"gray"} className="mr-1" />];
      }
      for (let i = 0; i < 5; i++) {
        stars.push(
          <FaStar
            key={i}
            color={i <= rating ? "gold" : "gray"}
            className="mr-1"
          />
        );
      }
    }
    return stars;
  };

  return (
    <span style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={cardStyle} data-testid="data_card-1">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-3">
            <div>
              <h5 className="card-title">{data.name}</h5>
              {!data.is_public && !data.is_public_orgs && (
                <span className="badge bg-secondary me-1">Private</span>
              )}
              {data.is_public_orgs && !data.is_public && (
                <span className="badge bg-info text-dark me-1">Org Only</span>
              )}
              <div className="d-flex">{renderStars(data.avg_rating - 1)}</div>
            </div>
            <div className="text-end">
              <Link to={`/profile/${data.author_username}`}>
                {data.author_username}
              </Link>
              <div className="text-muted">{data.formatted_date}</div>
            </div>
          </div>
          <p className="card-text" style={descriptionStyle}>
            {data.description}
          </p>
          <div className="row mt-auto">
            <div className="col-8">
              <strong>Tags:</strong>
              <div className="mt-1">
                {data.tags.map((tag, index) => (
                  <div className={styles.tag_item} key={index}>
                    <span className={styles.text}>{tag.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Add the download count and arrow here */}
          <div className="position-absolute bottom-0 end-0 mb-2 me-2 d-flex align-items-center">
            <FaArrowDown className="text-muted me-2" style={{ fontSize: '1.5rem' }} />
            <span className="badge bg-secondary">{data.download_count}</span>
          </div>
        </div>
      </div>
    </span>
  );
=======
    return React.createElement('span', { style: { textDecoration: 'none', color: 'inherit' } },
        React.createElement('div', { className: 'card', style: cardStyle, onKeyDown: handleKeyDown, tabIndex: 0, role: 'button' },
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
                React.createElement('div', { style: { flex: 1 } }),
                data.files && data.files.length > 0 && React.createElement('div', { style: { marginBottom: '8px', padding: '6px 8px', backgroundColor: '#f0f1f3', borderRadius: '4px', fontSize: '0.8rem' } },
                    React.createElement('strong', { style: { display: 'block', marginBottom: '4px', fontSize: '0.85rem' } }, 'Files:'),
                    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
                        data.files.slice(0, 6).map((file, index) => {
                            const ext = file.file_name ? file.file_name.split('.').pop().toUpperCase() : 'FILE';
                            return React.createElement('span', { key: index, style: { display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', backgroundColor: '#e5e7eb', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '500', whiteSpace: 'nowrap' } },
                                getFileTypeIcon(file.file_name),
                                React.createElement('span', { title: file.file_name }, ext)
                            );
                        }),
                        data.files.length > 6 && React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', backgroundColor: '#e5e7eb', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '500' } }, `+${data.files.length - 6}`)
                    )
                ),
                React.createElement('div', { className: 'd-flex justify-content-between align-items-flex-end', style: { marginTop: '8px' } },
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
>>>>>>> origin/feature/dataset-viewer
};

export default DataCard;