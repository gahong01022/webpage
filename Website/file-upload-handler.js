// 首先需要安裝 formidable 庫: npm install formidable

const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

// 文件上傳目錄
const UPLOADS_DIR = './uploads/blog-images';

// 確保上傳目錄存在
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 處理文件上傳
function handleFileUpload(req, callback) {
    const form = new formidable.IncomingForm();
    form.multiples = true;
    form.uploadDir = UPLOADS_DIR;
    
    // 解析上傳的表單
    form.parse(req, (err, fields, files) => {
        if (err) {
            console.error('File upload error:', err);
            return callback([], fields);
        }
        
        // 處理上傳的文件
        const uploadedFiles = [];
        
        // 處理單個文件
        if (files.images && !Array.isArray(files.images)) {
            files.images = [files.images];
        }
        
        // 處理多個文件
        if (files.images) {
            for (const file of files.images) {
                // 生成唯一的文件名
                const timestamp = Date.now();
                const fileExt = path.extname(file.originalFilename);
                const newFilename = `image_${timestamp}${fileExt}`;
                const newPath = path.join(UPLOADS_DIR, newFilename);
                
                // 移動並重命名文件
                fs.renameSync(file.filepath, newPath);
                
                // 添加到上傳文件列表
                uploadedFiles.push(`/uploads/blog-images/${newFilename}`);
            }
        }
        
        // 返回上傳的文件和表單字段
        callback(uploadedFiles, fields);
    });
}
