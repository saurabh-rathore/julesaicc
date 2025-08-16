// @desc    Handle file upload for fine-tuning
// @route   POST /api/fine-tuning/upload
// @access  Private
const handleFileUpload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  // For now, just acknowledge the upload.
  // In the future, we would add this to a queue or start a processing job.
  console.log('File uploaded successfully:', req.file);

  res.status(200).json({
    message: 'File uploaded successfully. Pending processing.',
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
  });
};

module.exports = {
  handleFileUpload,
};
