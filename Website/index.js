const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('querystring');
const formidable = require('formidable');
const https = require('https');

// 新增：YouTube播放清單ID
const YOUTUBE_PLAYLIST_ID = 'PL8kncYDmf0iyiTuQcydvHyHWsY0YCqmgT';

// 舊的音樂文件夾路徑（保留作為備用）
const MUSIC_FOLDER = 'D:\\MY SONG';
// 博客文章存儲路徑
const BLOG_FOLDER = './data/blog';

// 文件上傳目錄
const UPLOADS_DIR = './uploads/blog-images';
const ffprobe = require('fluent-ffmpeg').ffprobe;
// 確保博客文件夾存在
if (!fs.existsSync(BLOG_FOLDER)) {
    fs.mkdirSync(BLOG_FOLDER, { recursive: true });
}

// YouTube 數據緩存
let youtubeCache = {
    data: [],
    lastUpdate: 0
};

// 新增：從YouTube播放清單獲取視頻
async function getYoutubePlaylistData() {
    // 检查缓存是否已过期（设置为1小时）
    const cacheExpired = Date.now() - youtubeCache.lastUpdate > 3600000;
    
    if (youtubeCache.data.length > 0 && !cacheExpired) {
        console.log('Using cached YouTube data');
        return youtubeCache.data;
    }
    
    console.log('Fetching new YouTube playlist data...');
    
    try {
        // 使用簡單的方法獲取播放清單數據（無需API密鑰）
        // 實際生產環境應該使用YouTube API
        const playlistUrl = `https://youtube.com/playlist?list=${YOUTUBE_PLAYLIST_ID}`;
        
        // 由於直接抓取YouTube頁面比較複雜且不穩定，這里使用模擬數據
        // 實際應用中應該使用YouTube Data API
        
        // 獲取播放清單名稱和視頻
        const playlistData = await fetchYoutubePlaylistInfo(YOUTUBE_PLAYLIST_ID);
        
        // 更新緩存
        youtubeCache = {
            data: playlistData,
            lastUpdate: Date.now()
        };
        
        return playlistData;
    } catch (error) {
        console.error('Error fetching YouTube playlist:', error);
        
        // 如果失敗但有緩存，則返回緩存
        if (youtubeCache.data.length > 0) {
            console.log('Returning cached data after fetch error');
            return youtubeCache.data;
        }
        
        return [];
    }
}

// 模擬從YouTube獲取播放清單信息
// 實際應用中應使用YouTube Data API
async function fetchYoutubePlaylistInfo(playlistId) {
    try {
        // 获取播放列表中的视频
        const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=AIzaSyCcQ-m0YWhejOZDqEbzZaAUOA-BGI5J4Ng`);
        const playlistData = await playlistResponse.json();
        
        if (!playlistData.items || playlistData.items.length === 0) {
            throw new Error("No videos found in playlist");
        }
        
        // 收集所有视频ID
        const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',');
        
        // 获取视频详细信息，包括时长
        const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=AIzaSyCcQ-m0YWhejOZDqEbzZaAUOA-BGI5J4Ng`);
        const videoData = await videoResponse.json();
        
        // 创建视频ID到时长的映射
        const durationMap = {};
        videoData.items.forEach(item => {
            durationMap[item.id] = formatDuration(item.contentDetails.duration);
        });
        
        // 将时长信息添加到播放列表数据中
        return playlistData.items.map(item => {
            const videoId = item.snippet.resourceId.videoId;
            const snippet = item.snippet;
            return {
                videoId: videoId,
                title: snippet.title,
                thumbnail: snippet.thumbnails.high.url,
                channel: snippet.channelTitle,
                duration: durationMap[videoId] || "0:00", // 使用实际时长或默认值
                isVideo: true
            };
        });
    } catch (error) {
        console.error("Error fetching playlist info:", error);
        
        // 如果API调用失败，返回示例数据
        return [
            {
                videoId: 'dQw4w9WgXcQ',
                title: 'Rick Astley - Never Gonna Give You Up',
                thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
                channel: 'Rick Astley',
                duration: '3:33',
                isVideo: true
            },
            // ... 其他示例数据 ...
        ];
    }
}
// 将ISO 8601时长格式转换为人类可读格式
function formatDuration(isoDuration) {
    // 解析ISO 8601格式的时长字符串
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) {
        return "0:00";
    }
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    // 格式化为人类可读格式
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
// 讀取所有博客文章
function getAllBlogPosts() {
    try {
        const files = fs.readdirSync(BLOG_FOLDER);
        const posts = [];
        
        files.filter(file => file.endsWith('.json')).forEach(file => {
            const fileContent = fs.readFileSync(path.join(BLOG_FOLDER, file), 'utf8');
            posts.push(JSON.parse(fileContent));
        });
        
        // 按發布日期降序排序
        return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
        console.error('Error reading blog posts:', error);
        return [];
    }
}

// 保存博客文章
function saveBlogPost(postData) {
    try {
        const timestamp = Date.now();
        const filename = `post_${timestamp}.json`;
        fs.writeFileSync(path.join(BLOG_FOLDER, filename), JSON.stringify(postData, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving blog post:', error);
        return false;
    }
}

// 處理 POST 請求數據
function collectRequestData(request, callback) {
    const FORM_URLENCODED = 'application/x-www-form-urlencoded';
    const FORM_JSON = 'application/json';
    
    if (request.headers['content-type'] === FORM_URLENCODED) {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            callback(parse(body));
        });
    } else if (request.headers['content-type'] && request.headers['content-type'].includes(FORM_JSON)) {
        let body = '';
        request.on('data', chunk => {
            body += chunk.toString();
        });
        request.on('end', () => {
            callback(JSON.parse(body));
        });
    } else {
        callback({});
    }
}

// 處理上傳的圖片
function handleFileUpload(request, callback) {
    console.log("文件上傳處理尚未實現");
    callback([]);
}

const server = http.createServer((req, res) => {
    // CORS 支持
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 處理 OPTIONS 請求（預檢請求）
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }
    
    // API 端點：獲取YouTube播放清單的音樂
    if (req.url === '/api/music' && req.method === 'GET') {
        getYoutubePlaylistData()
            .then(musicFiles => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(musicFiles));
            })
            .catch(error => {
                console.error('Error getting YouTube playlist:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to get YouTube playlist' }));
            });
        return;
    }
    
    // API 端點：獲取所有博客文章
    if (req.url === '/api/blog/posts' && req.method === 'GET') {
        const posts = getAllBlogPosts();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(posts));
    }
    
    // API 端點：保存新博客文章
    if (req.url === '/api/blog/posts' && req.method === 'POST') {
        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            // 處理包含文件上傳的表單
            handleFileUpload(req, (files) => {
                collectRequestData(req, (formData) => {
                    // 將文件信息添加到表單數據中
                    formData.images = files;
                    
                    // 添加時間戳
                    formData.date = new Date().toISOString().split('T')[0];
                    formData.timestamp = Date.now();
                    
                    const success = saveBlogPost(formData);
                    
                    res.writeHead(success ? 201 : 500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ success }));
                });
            });
        } else {
            // 處理常規 JSON 表單
            collectRequestData(req, (postData) => {
                // 添加時間戳
                postData.date = new Date().toISOString().split('T')[0];
                postData.timestamp = Date.now();
                
                const success = saveBlogPost(postData);
                
                res.writeHead(success ? 201 : 500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success }));
            });
        }
        return;
    }
    
    // 處理流媒體請求 - 改為代理YouTube視頻（僅為示例，實際應用需要處理更多邏輯）
    if (req.url.startsWith('/api/stream/')) {
        res.writeHead(302, {
            'Location': `https://www.youtube.com/watch?v=${req.url.slice('/api/stream/'.length)}`
        });
        return res.end();
    }
    
    // 常規文件服務邏輯
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './main-page.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    let contentType = 'text/html';
    switch (extname) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpg'; break;
        case '.gif': contentType = 'image/gif'; break;
        case '.svg': contentType = 'image/svg+xml'; break;
        case '.wav': contentType = 'audio/wav'; break;
        case '.mp4': contentType = 'video/mp4'; break;
        case '.woff': contentType = 'application/font-woff'; break;
        case '.ttf': contentType = 'application/font-ttf'; break;
        case '.eot': contentType = 'application/vnd.ms-fontobject'; break;
        case '.otf': contentType = 'application/font-otf'; break;
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
    console.log(`YouTube Playlist: ${YOUTUBE_PLAYLIST_ID}`);
    console.log(`Storing blog posts in: ${BLOG_FOLDER}`);
});