// Builds the PWA for GitHub Pages (/surv base path) and force-pushes dist/
// to the gh-pages branch. Run: npm run deploy:pages
// Token: .git/gh_token.txt (device-flow token, never committed).

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const OWNER = 'markusyoon-afk';
const REPO = 'surv';

const tokenPath = path.join(root, '.git', 'gh_token.txt');
if (!fs.existsSync(tokenPath)) {
  console.error('No GitHub token at .git/gh_token.txt — run the device login first.');
  process.exit(1);
}
const token = fs.readFileSync(tokenPath, 'utf8').trim();
const remote = `https://x-access-token:${token}@github.com/${OWNER}/${REPO}.git`;

console.log('Building for GitHub Pages (base /surv)…');
execSync('npm run build:web', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, SURV_BASE_URL: `/${REPO}` },
});

// Pages serves the branch through Jekyll unless told otherwise; _expo/ starts
// with an underscore and would be silently dropped without .nojekyll.
fs.writeFileSync(path.join(root, 'dist', '.nojekyll'), '');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'surv-pages-'));
const run = (cmd) => execSync(cmd, { cwd: work, stdio: 'pipe' });

fs.cpSync(path.join(root, 'dist'), work, { recursive: true });
run('git init -b gh-pages');
run('git config user.name "Markus Yoon"');
run('git config user.email "markusyoon@gmail.com"');
run('git add -A');
run('git commit -m "Deploy SURV to GitHub Pages"');
run(`git push --force "${remote}" gh-pages`);
fs.rmSync(work, { recursive: true, force: true });

// Restore the root-path build so localhost preview keeps working.
console.log('Restoring local (root-path) build…');
execSync('npm run build:web', { cwd: root, stdio: 'inherit' });

console.log(`Deployed. Live at: https://${OWNER}.github.io/${REPO}/`);
