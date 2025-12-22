/**
 * GitHub Integration Services
 *
 * Services for GitHub OAuth and repository management.
 */

export {
    GitHubAuthService,
    getGitHubAuthService,
    createGitHubAuthService,
    type GitHubTokenResponse,
    type GitHubUserInfo,
    type GitHubConnection,
} from './github-auth-service.js';

export {
    GitHubRepoService,
    getGitHubRepoService,
    createGitHubRepoService,
    type RepoInfo,
    type PushResult,
    type ProjectRepoLink,
} from './github-repo-service.js';
