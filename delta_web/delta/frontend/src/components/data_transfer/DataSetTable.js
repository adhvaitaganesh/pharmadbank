import React, { useState, useRef, useEffect } from 'react';
import { connect } from 'react-redux';
import DataCard from './DataCard';
import tag_styles from './tags.module.css';
import { useNavigate } from 'react-router-dom';

import { createFolder } from "../../actions/folders";
import { FaFolderPlus, FaDownload, FaSpinner } from 'react-icons/fa';
import FolderCreatePopup from './FolderCreatePopup';
import axios from 'axios';

const DataSetTable = (props) => {
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const doubleClickTimeout = useRef(null);
    const navigate = useNavigate();
    const [selectedDataSets, setSelectedDataSets] = useState([]);
    const [searchText, setSearchFileName] = useState('');
    const [searchTags, setSearchTags] = useState([]);
    const [searchAuthor, setSearchAuthor] = useState('');
    const [searchFileTypes, setSearchFileTypes] = useState([]);
    const [isDownloading, setIsDownloading] = useState(false);
    const [tableCsvs, setTableCsvs] = useState(props.dataSets || []);
    const textMinLength = props.textMinLength !== undefined ? props.textMinLength : 3;
    const [tagSuggestions, setTagSuggestions] = useState([]);
    const dataSetsArray = props.dataSets || [];
    const allTags = new Set(dataSetsArray.flatMap((csvFile) => csvFile.tags ? csvFile.tags.map((tag) => tag.text) : []));

    const handleTagClick = (tag) => {
        const updatedTags = [...new Set([...searchTags.slice(0, searchTags.length - 1), tag])];
        setSearchTags(updatedTags);
        const elem = document.getElementById('inputSearchTags');
        if (elem) elem.value = updatedTags.join(' ');
        setTagSuggestions([]);
    };

    const handleCheckboxChange = (datasetId) => {
        const dataset = tableCsvs.find(d => d.id === datasetId);
        if (!dataset) return;
        if (selectedDataSets.find(d => d.id === datasetId)) { setSelectedDataSets(selectedDataSets.filter(d => d.id !== datasetId)); } else { setSelectedDataSets([...selectedDataSets, dataset]); }
    };

    const handleSelectAll = () => {
        if (selectedDataSets.length === tableCsvs.length && tableCsvs.length > 0) { setSelectedDataSets([]); } else { setSelectedDataSets([...tableCsvs]); }
    };

    const handleClearAll = () => { setSelectedDataSets([]); };

    const handleAddToFolder = () => {
        if (selectedDataSets.length > 0) { setIsPopupVisible(true); } else { alert("Please select at least one dataset to add to the folder."); }
    };

    const onSearchChange = () => {
        const srcFileName = document.getElementById('inputSearchFileName');
        const srcTags = document.getElementById('inputSearchTags');
        const srcAuthor = document.getElementById('inputSearchAuthor');
        const srcFileTypes = document.getElementById('inputSearchFileTypes');

        const strFileNameSearch = (srcFileName ? srcFileName.value : '').toLowerCase();
        const strTagSearch = (srcTags ? srcTags.value : '');
        const arrStrTagSearch = strTagSearch.split(' ').map((e) => e.toLowerCase());
        const strAuthorSearch = (srcAuthor ? srcAuthor.value : '').toLowerCase();
        const arrFileTypeSearch = (srcFileTypes ? srcFileTypes.value : '').split(' ').map((e) => e.toLowerCase());

        setSearchFileName(strFileNameSearch);
        setSearchTags(arrStrTagSearch);
        setSearchAuthor(strAuthorSearch);

        if (!strTagSearch) { setTagSuggestions([]); } else {
            const filteredTags = Array.from(allTags).filter((tag) => tag.toLowerCase().includes(arrStrTagSearch[arrStrTagSearch.length - 1]));
            setTagSuggestions(filteredTags);
        }

        let filteredCsvs = dataSetsArray.filter((csvFile) => {
            const arrStrFileTags = csvFile.tags ? csvFile.tags.map((strObj) => strObj.text) : [];
            const arrStrFileTypes = csvFile.files ? csvFile.files.map((obj) => obj.file_name.split('.').pop()) : [];
            const allTagsMatch = arrStrTagSearch.every((searchTag) => searchTag.length === 0 || arrStrFileTags.some((fileTag) => fileTag.toLowerCase().includes(searchTag)));
            const nameMatches = strFileNameSearch.length < textMinLength || csvFile.name.toLowerCase().includes(strFileNameSearch);
            const authorMatches = strAuthorSearch.length < textMinLength || csvFile.author_username.toLowerCase().includes(strAuthorSearch);
            const fileTypeMatches = arrFileTypeSearch.every((searchType) => searchType.length < textMinLength || arrStrFileTypes.some((fileType) => fileType.toLowerCase().includes(searchType)));
            return allTagsMatch && nameMatches && authorMatches && fileTypeMatches;
        });
        setTableCsvs(filteredCsvs);
    };

    const handleDoubleClickDataSet = (item) => { navigate(`/datasets/${item.id}`); };

    useEffect(() => { if (props.dataSets && props.dataSets.length > 0) { setTableCsvs(props.dataSets); } }, [props.dataSets]);

    useEffect(() => { return () => { clearTimeout(doubleClickTimeout.current); }; }, []);



<<<<<<< HEAD
        )}
      </div>
      <div className="mb-2">
        <label htmlFor="inputSearchAuthor" className="form-label">
          Author
        </label>
        <input
          type="text"
          className="form-control"
          id="inputSearchAuthor"
          placeholder="Enter an author associated with the dataset."
          onChange={onSearchChange}
        />
        <div className="form-text">
          For example, enter "user123" to see public files uploaded by "user123".
        </div>
      </div>
      <div className="d-flex flex-row align-items-center mb-3">
        <div className="d-flex align-items-center">
          <button 
            className="btn btn-primary d-flex align-items-center me-2"
            onClick={handleAddToFolder}
          >
            <FaFolderPlus className="me-1" />
            Add to Folder
          </button>
        </div>
        <button className="btn btn-success d-flex align-items-center" onClick={massAddToCart}>
          <FaCartPlus className="me-1" />
          Add to Downloads
        </button>
      </div>
      <span>
        <strong>{selectedDataSets.length}</strong> file(s) selected.
      </span>
      <p>Double click to view a dataset.</p>
      <div className="row">
          {renderItems()}
      </div>
      <FolderCreatePopup
      isVisible={isPopupVisible} 
      onClose={() => setIsPopupVisible(false)} 
      selectedDataSets={selectedDataSets}
      createFolder={props.createFolder}
    />
  </div>
);
=======
    const handleDownloadSelected = async() => {
        if (selectedDataSets.length === 0) { alert('Please select at least one dataset to download.'); return; }
        setIsDownloading(true);
        try {
            const dataset_ids = selectedDataSets.map(d => d.id);
            const response = await axios.post('/api/datasets/download/', { dataset_ids }, { headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${props.auth.token}` }, responseType: 'blob' });
            if (response.data.size === 0) {
                alert('ERROR: Downloaded file is empty. Check browser console and Django logs for details.');
                setIsDownloading(false);
                return;
            }
            const blob = new Blob([response.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `datasets_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setIsDownloading(false);
        } catch (error) {
            console.error('Download failed:', error);
            let errorMsg = 'Unknown error';
            if (error && error.response && error.response.data && error.response.data.error) errorMsg = error.response.data.error;
            else if (error && error.message) errorMsg = error.message;
            alert(`Failed to download datasets:\n${errorMsg}\n\nCheck browser console for more details.`);
            setIsDownloading(false);
        }
    };

    const renderItems = () => {
        return tableCsvs.map((item) => {
            const isSelected = selectedDataSets.some(d => d.id === item.id);
            const handleCardClick = () => {
                if (doubleClickTimeout.current) {
                    clearTimeout(doubleClickTimeout.current);
                    handleDoubleClickDataSet(item);
                    doubleClickTimeout.current = null;
                } else { doubleClickTimeout.current = setTimeout(() => { doubleClickTimeout.current = null; }, 200); }
            };
            return React.createElement('div', { className: 'col-4', key: item.id }, React.createElement('span', { onClick: handleCardClick }, React.createElement(DataCard, { data: item, isSelected: isSelected, onCheckboxChange: handleCheckboxChange })));
        });
    };

    return React.createElement('div', { className: 'container' },
        React.createElement('div', { className: 'mb-3' }, React.createElement('h4', null, 'Search Datasets')),
        React.createElement('div', { className: 'mb-2' }, React.createElement('label', { htmlFor: 'inputSearchFileName', className: 'form-label' }, 'File Name'), React.createElement('input', { type: 'text', className: 'form-control', id: 'inputSearchFileName', placeholder: `Enter at least ${textMinLength} characters`, onChange: onSearchChange })),
        React.createElement('div', { className: 'mb-2' }, React.createElement('label', { htmlFor: 'inputSearchFileTypes', className: 'form-label' }, 'File Type(s)'), React.createElement('input', { type: 'text', className: 'form-control', id: 'inputSearchFileTypes', placeholder: `Enter at least ${textMinLength} characters`, onChange: onSearchChange })),
        React.createElement('div', { className: 'mb-2' },
            React.createElement('label', { htmlFor: 'inputSearchTags', className: 'form-label' }, 'Tags'),
            React.createElement('input', { type: 'text', className: 'form-control', id: 'inputSearchTags', placeholder: 'Enter tags separated by spaces', onChange: onSearchChange }),
            React.createElement('div', { className: 'form-text' }, 'For example, enter "cat dog" to see files with tags of "cat" and "dog".'),
            tagSuggestions.length > 0 && React.createElement('div', { className: 'tag-suggestions', style: { display: 'flex', flexWrap: 'wrap', marginTop: '8px' } }, tagSuggestions.map((tag) => React.createElement('div', { key: tag, onClick: () => handleTagClick(tag), style: {...tag_styles.tagSuggestionItem, display: 'flex', cursor: 'pointer' } }, React.createElement('span', { className: tag_styles.tag_item }, tag))))
        ),
        React.createElement('div', { className: 'mb-2' }, React.createElement('label', { htmlFor: 'inputSearchAuthor', className: 'form-label' }, 'Author'), React.createElement('input', { type: 'text', className: 'form-control', id: 'inputSearchAuthor', placeholder: 'Enter an author associated with the dataset.', onChange: onSearchChange }), React.createElement('div', { className: 'form-text' }, 'For example, enter "user123" to see public files uploaded by "user123".')),
        React.createElement('div', { className: 'd-flex flex-row align-items-center mb-3 gap-2 justify-content-between' },
            React.createElement('div', { className: 'd-flex gap-2' },
                React.createElement('button', { className: 'btn btn-primary d-flex align-items-center', onClick: handleAddToFolder }, React.createElement(FaFolderPlus, { className: 'me-1' }), ' Add to Folder'),
                React.createElement('button', { className: 'btn btn-success d-flex align-items-center', onClick: handleDownloadSelected, disabled: selectedDataSets.length === 0 || isDownloading, style: { opacity: selectedDataSets.length === 0 || isDownloading ? 0.5 : 1 } }, isDownloading ? React.createElement(FaSpinner, { className: 'me-1 spinner-animation' }) : React.createElement(FaDownload, { className: 'me-1' }), ' Download Selected')
            ),
            React.createElement('div', { className: 'd-flex gap-2 align-items-center' },
                React.createElement('span', null, `Selected: ${selectedDataSets.length}`),
                React.createElement('button', { className: 'btn btn-sm btn-outline-secondary', onClick: handleSelectAll }, selectedDataSets.length === tableCsvs.length && tableCsvs.length > 0 ? 'Deselect All' : 'Select All'),
                React.createElement('button', { className: 'btn btn-sm btn-outline-secondary', onClick: handleClearAll }, 'Clear')
            )
        ),
        React.createElement('div', { className: 'row mt-4' }, renderItems()),
        isPopupVisible && React.createElement(FolderCreatePopup, { close: () => setIsPopupVisible(false), dataSets: selectedDataSets })
    );
>>>>>>> origin/feature/dataset-viewer
};

const mapStateToProps = (state) => { return { auth: state.auth }; };
const mapDispatchToProps = { createFolder };
export default connect(mapStateToProps, mapDispatchToProps)(DataSetTable);