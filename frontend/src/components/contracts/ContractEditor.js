import React, { useRef, useEffect } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './ContractEditor.css';

const toolbarOptions = [
  [{ 'header': [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  [{ 'indent': '-1'}, { 'indent': '+1' }],
  [{ 'align': [] }],
  ['link'],
  ['clean']
];

function ContractEditor({ content, onChange, readOnly = false, placeholder = 'Start writing your contract...' }) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);

  useEffect(() => {
    if (!quillRef.current) {
      quillRef.current = new Quill(editorRef.current, {
        theme: 'snow',
        readOnly,
        placeholder,
        modules: {
          toolbar: readOnly ? false : toolbarOptions,
        },
      });

      if (!readOnly) {
        quillRef.current.on('text-change', () => {
          const html = quillRef.current.root.innerHTML;
          onChange && onChange(html);
        });
      }
    }

    // Set initial content
    if (content && quillRef.current.root.innerHTML !== content) {
      quillRef.current.root.innerHTML = content;
    }
  }, []);

  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!readOnly);
    }
  }, [readOnly]);

  useEffect(() => {
    if (quillRef.current && content !== quillRef.current.root.innerHTML) {
      const selection = quillRef.current.getSelection();
      quillRef.current.root.innerHTML = content || '';
      if (selection) {
        quillRef.current.setSelection(selection);
      }
    }
  }, [content]);

  return (
    <div className={`contract-editor ${readOnly ? 'readonly' : ''}`}>
      <div ref={editorRef} className="editor-container" />
    </div>
  );
}

export default ContractEditor;