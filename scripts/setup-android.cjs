const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

const targetDir = 'C:\\Android';
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

const zipPath = path.join(targetDir, 'cmdline-tools.zip');
console.log('Downloading Android Command Line Tools (~140MB)...');

const download = (url, dest, cb) => {
  const file = fs.createWriteStream(dest);
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      return download(res.headers.location, dest, cb);
    }
    const total = parseInt(res.headers['content-length'] || '0', 10);
    let cur = 0;
    res.on('data', (chunk) => {
      cur += chunk.length;
      if (total) {
        process.stdout.write(`\rProgress: ${((cur / total) * 100).toFixed(1)}% (${(cur / 1024 / 1024).toFixed(1)} MB)`);
      }
    });
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      console.log('\nDownload complete.');
      cb();
    });
  }).on('error', (err) => {
    fs.unlinkSync(dest);
    cb(err);
  });
};

download('https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip', zipPath, (err) => {
  if (err) {
    console.error('Download failed:', err);
    process.exit(1);
  }
  console.log('Extracting archive...');
  const tempExtract = 'C:\\Android\\temp_cmdline';
  if (fs.existsSync(tempExtract)) fs.rmSync(tempExtract, { recursive: true, force: true });
  
  execSync(`tar -xf "${zipPath}" -C "C:\\Android"`);
  
  const finalLatest = 'C:\\Android\\cmdline-tools\\latest';
  if (!fs.existsSync('C:\\Android\\cmdline-tools')) fs.mkdirSync('C:\\Android\\cmdline-tools', { recursive: true });
  if (fs.existsSync(finalLatest)) fs.rmSync(finalLatest, { recursive: true, force: true });
  
  // cmdline-tools is extracted to C:\Android\cmdline-tools
  // We need C:\Android\cmdline-tools\latest\bin
  fs.renameSync('C:\\Android\\cmdline-tools', 'C:\\Android\\cmdline-tools-extracted');
  fs.mkdirSync('C:\\Android\\cmdline-tools', { recursive: true });
  fs.renameSync('C:\\Android\\cmdline-tools-extracted', finalLatest);
  
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  console.log('Successfully set up Android cmdline-tools at C:\\Android\\cmdline-tools\\latest');
});
