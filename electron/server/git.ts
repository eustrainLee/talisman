import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import simpleGit from 'simple-git';
import { promisify } from 'util';
import log from 'electron-log';
import * as os from 'os';

const globPromise = promisify(glob);

// 确保 fetch 可用
const fetch = global.fetch || require('node-fetch');

export interface GitConfig {
  repo_url: string;
  branch: string;
  doc_path?: string;
  use_ssh?: boolean;
  ssh_key_path?: string;
}

export interface PullRequestConfig {
  title: string;
  description: string;
  branch: string;
  targetBranch: string;
}

// 获取默认 SSH 密钥路径
export function getDefaultSSHKeyPath(): string {
  try {
    const homeDir = os.homedir();
    const sshDir = path.join(homeDir, '.ssh');
    
    // 检查常见的 SSH 密钥文件
    const commonKeyFiles = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
    
    for (const keyFile of commonKeyFiles) {
      const keyPath = path.join(sshDir, keyFile);
      if (fs.existsSync(keyPath)) {
        return keyPath;
      }
    }
    
    // 如果没有找到密钥文件，返回默认路径
    return path.join(sshDir, 'id_rsa');
  } catch (error) {
    log.error('Failed to get default SSH key path:', error);
    return '';
  }
}

// 保存 Git 令牌
export async function saveToken(configDir: string, platform: string, token: string): Promise<boolean> {
  try {
    // 创建 git 目录
    const gitDir = path.join(configDir, 'git');
    await fsPromises.mkdir(gitDir, { recursive: true });
    
    const tokenPath = path.join(gitDir, `${platform}-token.txt`);
    await fsPromises.writeFile(tokenPath, token, 'utf-8');
    
    // 设置文件权限为仅当前用户可读写
    if (process.platform !== 'win32') {
      await fsPromises.chmod(tokenPath, 0o600);
    }
    
    return true;
  } catch (error) {
    log.error(`Failed to save ${platform} token:`, error);
    return false;
  }
}

// 获取 Git 令牌
export async function getToken(configDir: string, platform: string): Promise<string> {
  try {
    const gitDir = path.join(configDir, 'git');
    const tokenPath = path.join(gitDir, `${platform}-token.txt`);
    
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, 'utf-8').trim();
    }
    
    return '';
  } catch (error) {
    log.error(`Failed to get ${platform} token:`, error);
    return '';
  }
}

// 从远程仓库拉取文档
export async function pullFromGit(
  tempDir: string,
  targetPath: string,
  gitConfig: GitConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // 清理旧的临时目录（如果存在）
    if (fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
    
    // 确保临时目录存在
    await fsPromises.mkdir(tempDir, { recursive: true });
    
    // 配置 Git
    const gitOptions: any = {};
    if (gitConfig.use_ssh && gitConfig.ssh_key_path) {
      gitOptions.env = {
        ...process.env,
        GIT_SSH_COMMAND: `ssh -i "${gitConfig.ssh_key_path}" -o StrictHostKeyChecking=no`
      };
    }
    
    // 克隆仓库到临时目录
    const git = simpleGit(gitOptions);
    await git.clone(gitConfig.repo_url, tempDir);
    
    // 切换到指定分支
    const tempGit = simpleGit(tempDir, gitOptions);
    await tempGit.checkout(gitConfig.branch);
    
    // 清理目标目录中的内容（保留目录本身）
    const entries = await fsPromises.readdir(targetPath);
    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry);
      await fsPromises.rm(entryPath, { recursive: true, force: true });
    }
    
    // 复制文档
    const sourceDir = gitConfig.doc_path ? path.join(tempDir, gitConfig.doc_path) : tempDir;
    const files = await globPromise('**/*.{md,json,txt}', { cwd: sourceDir });
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetFilePath = path.join(targetPath, file);
      // 确保文件所在的目录存在
      await fsPromises.mkdir(path.dirname(targetFilePath), { recursive: true });
      await fsPromises.copyFile(sourcePath, targetFilePath);
    }
    
    // 清理临时克隆目录
    await fsPromises.rm(tempDir, { recursive: true, force: true });
    
    return { success: true };
  } catch (error) {
    log.error('Git pull failed:', error);
    // 清理临时目录
    try {
      if (fs.existsSync(tempDir)) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      log.error('Failed to clean up temp directory:', e);
    }
    return { success: false, error: String(error) };
  }
}

// 创建 Pull Request
export async function createPullRequest(
  configDir: string,
  tempDir: string,
  sourcePath: string,
  gitConfig: GitConfig,
  prConfig: PullRequestConfig
): Promise<{ success: boolean; prUrl?: string; error?: string }> {
  try {
    log.info('Starting to create Pull Request:', { sourcePath, gitConfig, prConfig });
    
    // 清理旧的临时目录（如果存在）
    if (fs.existsSync(tempDir)) {
      log.debug('Cleaning old temp directory:', tempDir);
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
    
    // 确保临时目录存在
    log.debug('Creating temp directory:', tempDir);
    await fsPromises.mkdir(tempDir, { recursive: true });
    
    // 配置 Git
    const gitOptions: any = {};
    if (gitConfig.use_ssh && gitConfig.ssh_key_path) {
      log.debug('Using SSH key:', gitConfig.ssh_key_path);
      gitOptions.env = {
        ...process.env,
        GIT_SSH_COMMAND: `ssh -i "${gitConfig.ssh_key_path}" -o StrictHostKeyChecking=no`
      };
    }
    
    // 克隆仓库到临时目录
    log.debug('Cloning repository:', gitConfig.repo_url);
    const git = simpleGit(gitOptions);
    await git.clone(gitConfig.repo_url, tempDir);
    
    // 切换到目标分支
    log.debug('Checking out target branch:', prConfig.targetBranch);
    const tempGit = simpleGit(tempDir, gitOptions);
    await tempGit.checkout(prConfig.targetBranch);
    
    // 创建新分支
    log.debug('Creating new branch:', prConfig.branch);
    await tempGit.checkoutLocalBranch(prConfig.branch);
    
    // 复制文档到仓库
    const targetDir = gitConfig.doc_path ? path.join(tempDir, gitConfig.doc_path) : tempDir;
    log.debug('Target directory:', targetDir);
    
    // 确保目标目录存在
    await fsPromises.mkdir(targetDir, { recursive: true });
    
    // 复制文件
    log.debug('Starting to copy files from:', sourcePath);
    const files = await globPromise('**/*.{md,json,txt}', { cwd: sourcePath });
    log.debug('Found files:', files.length);
    for (const file of files) {
      const sourceFilePath = path.join(sourcePath, file);
      const targetFilePath = path.join(targetDir, file);
      // 确保文件所在的目录存在
      await fsPromises.mkdir(path.dirname(targetFilePath), { recursive: true });
      await fsPromises.copyFile(sourceFilePath, targetFilePath);
    }
    
    // 添加所有更改
    log.debug('Adding changes to Git');
    await tempGit.add('.');
    
    // 提交更改
    log.debug('Committing changes:', prConfig.title);
    await tempGit.commit(prConfig.title);
    
    // 推送到远程
    log.debug('Pushing to remote:', prConfig.branch);
    await tempGit.push('origin', prConfig.branch, ['--set-upstream']);
    
    // 获取仓库 URL 信息以构建 PR URL
    const repoUrl = gitConfig.repo_url;
    let prUrl = '';
    
    // 解析仓库 URL 以构建 PR URL
    if (repoUrl.includes('github.com')) {
      // GitHub 格式
      const repoPath = repoUrl.replace(/^(https:\/\/github\.com\/|git@github\.com:)/, '').replace(/\.git$/, '');
      log.debug('GitHub repository path:', repoPath);
      
      // 使用 GitHub API 创建 PR
      try {
        // 提取 owner 和 repo
        const [owner, repo] = repoPath.split('/');
        log.debug('GitHub repository info:', { owner, repo });
        
        // 构建 API URL
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls`;
        log.debug('GitHub API URL:', apiUrl);
        
        // 准备 PR 数据
        const prData = {
          title: prConfig.title,
          body: prConfig.description,
          head: prConfig.branch,
          base: prConfig.targetBranch
        };
        log.debug('PR data:', prData);
        
        // 获取 GitHub 令牌
        const githubToken = await getToken(configDir, 'github');
        log.debug('GitHub token exists:', !!githubToken);
        
        // 如果有令牌，使用 API 创建 PR
        if (githubToken) {
          log.debug('Using GitHub API to create PR');
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `token ${githubToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Talisman-App'
            },
            body: JSON.stringify(prData)
          });
          
          log.debug('GitHub API response status:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            prUrl = result.html_url;
            log.info('Successfully created GitHub PR:', prUrl);
          } else {
            const errorData = await response.json();
            log.error('GitHub API failed to create PR:', errorData);
            // 回退到手动创建 PR 的 URL
            prUrl = `https://github.com/${repoPath}/compare/${prConfig.targetBranch}...${prConfig.branch}?expand=1&title=${encodeURIComponent(prConfig.title)}&body=${encodeURIComponent(prConfig.description)}`;
            log.debug('Falling back to manual PR URL:', prUrl);
          }
        } else {
          // 没有令牌，使用手动创建 PR 的 URL
          log.debug('No GitHub token, using manual PR URL');
          prUrl = `https://github.com/${repoPath}/compare/${prConfig.targetBranch}...${prConfig.branch}?expand=1&title=${encodeURIComponent(prConfig.title)}&body=${encodeURIComponent(prConfig.description)}`;
          log.debug('Manual PR URL:', prUrl);
        }
      } catch (error) {
        log.error('Failed to create GitHub PR:', error);
        // 回退到手动创建 PR 的 URL
        prUrl = `https://github.com/${repoPath}/compare/${prConfig.targetBranch}...${prConfig.branch}?expand=1&title=${encodeURIComponent(prConfig.title)}&body=${encodeURIComponent(prConfig.description)}`;
        log.debug('Falling back to manual PR URL after error:', prUrl);
      }
    } else if (repoUrl.includes('gitlab.com')) {
      // GitLab 格式
      const repoPath = repoUrl.replace(/^(https:\/\/gitlab\.com\/|git@gitlab\.com:)/, '').replace(/\.git$/, '');
      log.debug('GitLab repository path:', repoPath);
      
      // 使用 GitLab API 创建 PR
      try {
        // 构建 API URL (GitLab 使用项目 ID，但我们可以使用路径)
        const apiUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(repoPath)}/merge_requests`;
        log.debug('GitLab API URL:', apiUrl);
        
        // 准备 MR 数据
        const mrData = {
          title: prConfig.title,
          description: prConfig.description,
          source_branch: prConfig.branch,
          target_branch: prConfig.targetBranch,
          remove_source_branch: false
        };
        log.debug('MR data:', mrData);
        
        // 获取 GitLab 令牌
        const gitlabToken = await getToken(configDir, 'gitlab');
        log.debug('GitLab token exists:', !!gitlabToken);
        
        // 如果有令牌，使用 API 创建 MR
        if (gitlabToken) {
          log.debug('Using GitLab API to create MR');
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'PRIVATE-TOKEN': gitlabToken,
              'Content-Type': 'application/json',
              'User-Agent': 'Talisman-App'
            },
            body: JSON.stringify(mrData)
          });
          
          log.debug('GitLab API response status:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            prUrl = result.web_url;
            log.info('Successfully created GitLab MR:', prUrl);
          } else {
            const errorData = await response.json();
            log.error('GitLab API failed to create MR:', errorData);
            // 回退到手动创建 MR 的 URL
            prUrl = `https://gitlab.com/${repoPath}/-/merge_requests/new?merge_request[source_branch]=${prConfig.branch}&merge_request[target_branch]=${prConfig.targetBranch}&merge_request[title]=${encodeURIComponent(prConfig.title)}&merge_request[description]=${encodeURIComponent(prConfig.description)}`;
            log.debug('Falling back to manual MR URL:', prUrl);
          }
        } else {
          // 没有令牌，使用手动创建 MR 的 URL
          log.debug('No GitLab token, using manual MR URL');
          prUrl = `https://gitlab.com/${repoPath}/-/merge_requests/new?merge_request[source_branch]=${prConfig.branch}&merge_request[target_branch]=${prConfig.targetBranch}&merge_request[title]=${encodeURIComponent(prConfig.title)}&merge_request[description]=${encodeURIComponent(prConfig.description)}`;
          log.debug('Manual MR URL:', prUrl);
        }
      } catch (error) {
        log.error('Failed to create GitLab MR:', error);
        // 回退到手动创建 MR 的 URL
        prUrl = `https://gitlab.com/${repoPath}/-/merge_requests/new?merge_request[source_branch]=${prConfig.branch}&merge_request[target_branch]=${prConfig.targetBranch}&merge_request[title]=${encodeURIComponent(prConfig.title)}&merge_request[description]=${encodeURIComponent(prConfig.description)}`;
        log.debug('Falling back to manual MR URL after error:', prUrl);
      }
    } else {
      log.warn('Unsupported repository URL format:', repoUrl);
      prUrl = '';
    }
    
    // 清理临时目录
    log.debug('Cleaning up temp directory');
    await fsPromises.rm(tempDir, { recursive: true, force: true });
    
    log.info('PR creation completed, URL:', prUrl);
    return { 
      success: true, 
      prUrl: prUrl 
    };
  } catch (error) {
    log.error('Failed to create Pull Request:', error);
    // 清理临时目录
    try {
      if (fs.existsSync(tempDir)) {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      log.error('Failed to clean up temp directory:', e);
    }
    return { success: false, error: String(error) };
  }
} 