<h3>📎 Upload CMS-2567 PDF</h3>
<div {...getRootProps()} style={{
  border: '3px dashed #0077cc',
  backgroundColor: '#f0f8ff',
  padding: '40px',
  textAlign: 'center',
  marginBottom: '30px',
  cursor: 'pointer',
  borderRadius: '12px'
}}>
  <input {...getInputProps()} />
  {isDragActive ? (
    <p><strong>Drop your CMS-2567 PDF here...</strong></p>
  ) : (
    <p>Click or drag your <strong>2567 PDF</strong> into this box to extract deficiencies and F-Tags</p>
  )}
</div>
