const fs = require('fs');
const path = require('path');

const TOP_LEVEL_COLLECTIONS = [
    'activities', 'activityLogs', 'ai_activity_log', 'app_config', 'audit_logs',
    'club_billings', 'clubs', 'config', 'manager_chats', 'manager_notifications',
    'matches', 'payments', 'profileChangeRequests', 'reports', 'subscription_types',
    'subscriptions', 'tournaments', 'transactions', 'users'
];

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
            callback(dirPath);
        }
    });
}

let modifiedFiles = [];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    for (const colName of TOP_LEVEL_COLLECTIONS) {
        // Match collection(db, "col") or doc(db, "col", ...)
        const regex = new RegExp(`(collection|doc)\\(\\s*db\\s*,\\s*["']${colName}["']`, 'g');
        content = content.replace(regex, (match, p1) => {
            return `${p1}(db, col('${colName}')`;
        });
    }

    if (content !== original) {
        // Inject import if needed
        if (!content.includes("from './config/environment'") && 
            !content.includes("from '../config/environment'") && 
            !content.includes("from '../../config/environment'") &&
            !content.includes("from '../../../config/environment'") &&
            !content.includes("from '../../../../config/environment'")) {
            
            const depth = filePath.replace(/\\/g, '/').split('/').filter(p => p !== 'src').length - 2;
            let upDir = '';
            if (depth <= 0) upDir = './';
            else {
                for(let i=0; i<depth; i++) upDir += '../';
            }
            
            const importStatement = `import { col } from '${upDir}config/environment';\n`;
            
            const lines = content.split('\n');
            let lastImportIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('import ')) {
                    lastImportIdx = i;
                }
            }
            if (lastImportIdx !== -1) {
                lines.splice(lastImportIdx + 1, 0, importStatement);
                content = lines.join('\n');
            } else {
                content = importStatement + content;
            }
        }
        fs.writeFileSync(filePath, content);
        modifiedFiles.push(filePath);
    }
}

walkDir('src', processFile);

console.log(JSON.stringify(modifiedFiles, null, 2));
