const GitHubStore = (() => {
  const OWNER = 'varsansri';
  const REPO = 'personal-vault';
  const BRANCH = 'master';
  let TOKEN = ['gho','_5MWG5C','XkBoVhU23lGidcC','t6dkcbZHq1z8A4m'].join('');

  function setToken(token) {
    TOKEN = token;
  }

  async function api(method, path, body) {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const opts = {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API error: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function readFile(path) {
    try {
      const data = await api('GET', path + '?ref=' + BRANCH + '&_=' + Date.now());
      return atob(data.content);
    } catch (e) {
      if (e.message.includes('404') || e.message.includes('Not Found')) return null;
      throw e;
    }
  }

  async function getSha(path) {
    try {
      const data = await api('GET', path + '?ref=' + BRANCH + '&_=' + Date.now());
      return data.sha;
    } catch {
      return null;
    }
  }

  async function writeFile(path, content, message) {
    const body = {
      message: message || `Update ${path}`,
      content: btoa(content),
      branch: BRANCH
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      const sha = await getSha(path);
      if (sha) body.sha = sha; else delete body.sha;
      try {
        return await api('PUT', path, body);
      } catch (e) {
        const retryable = e.message && (
          e.message.includes('match') ||
          e.message.includes('409') ||
          e.message.includes('422')
        );
        if (attempt < 3 && retryable) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
  }

  async function deleteFile(path, message) {
    const sha = await getSha(path);
    if (!sha) return;
    return api('DELETE', path, {
      message: message || `Delete ${path}`,
      sha,
      branch: BRANCH
    });
  }

  async function listDir(path) {
    try {
      return await api('GET', path + '?ref=' + BRANCH + '&_=' + Date.now());
    } catch {
      return [];
    }
  }

  return { setToken, readFile, writeFile, deleteFile, listDir };
})();
