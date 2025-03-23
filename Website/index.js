const http = require('http');
const fs = require('fs');
const path = require('path');

// Music folder path - change this to your actual music folder path
const MUSIC_FOLDER = 'D:\\My Works\\mymusic';

// Function to scan music directory and get music files
function scanMusicFolder() {
    try {
        const files = fs.readdirSync(MUSIC_FOLDER);
        const musicFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp3', '.wav', '.ogg', '.flac'].includes(ext);
        });

        return musicFiles.map(file => {
            // Get file stats for additional info
            const stats = fs.statSync(path.join(MUSIC_FOLDER, file));
            
            // Basic info about the music file
            return {
                fileName: file,
                title: path.parse(file).name, // Use filename without extension as title
                artist: "Unknown", // You might want to extract this from ID3 tags
                size: stats.size,
                duration: "0:00" // Duration would require audio processing libraries
            };
        });
    } catch (error) {
        console.error('Error scanning music folder:', error);
        return [];
    }
}

const server = http.createServer((req, res) => {
    // Special route to get music files
    if (req.url === '/api/music') {
        const musicFiles = scanMusicFolder();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(musicFiles));
    }
    
    // Special route to stream a music file
    if (req.url.startsWith('/api/stream/')) {
        const fileName = decodeURIComponent(req.url.slice('/api/stream/'.length));
        const filePath = path.join(MUSIC_FOLDER, fileName);
        
        // Check if file exists and is within music folder (security)
        if (!fs.existsSync(filePath) || !filePath.startsWith(MUSIC_FOLDER)) {
            res.writeHead(404);
            return res.end('File not found');
        }
        
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        if (range) {
            // Handle range requests for streaming
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'audio/mpeg'
            });
            
            file.pipe(res);
        } else {
            // Handle regular requests
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': 'audio/mpeg'
            });
            fs.createReadStream(filePath).pipe(res);
        }
        
        return;
    }
    
    // Regular file serving logic
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './main-page.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.gif':
            contentType = 'image/gif';
            break;
        case '.svg':
            contentType = 'image/svg+xml';
            break;
        case '.wav':
            contentType = 'audio/wav';
            break;
        case '.mp4':
            contentType = 'video/mp4';
            break;
        case '.woff':
            contentType = 'application/font-woff';
            break;
        case '.ttf':
            contentType = 'application/font-ttf';
            break;
        case '.eot':
            contentType = 'application/vnd.ms-fontobject';
            break;
        case '.otf':
            contentType = 'application/font-otf';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, there was an error: ' + error.code + ' ..\n', 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Serving music from: ${MUSIC_FOLDER}`);
});
