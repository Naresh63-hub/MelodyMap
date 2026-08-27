export function renderErrorPage(error?: unknown): string {
  const timestamp = new Date().toLocaleString();
  const errorMessage =
    error instanceof Error ? error.message : error ? String(error) : "Unknown error";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MelodyMap — Something went wrong</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #0a0a18; color: #f1f1f1; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      .brand { font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, #ec4899, #a855f7, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 1rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #9ca3af; margin: 0 0 1.5rem; }
      .detail { background: #1a1a2e; border-radius: 0.5rem; padding: 0.75rem; margin-bottom: 1.5rem; font-size: 0.8rem; color: #6b7280; text-align: left; word-break: break-word; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: linear-gradient(135deg, #ec4899, #a855f7); color: #fff; border: none; }
      .secondary { background: #1a1a2e; color: #d1d5db; border-color: #374151; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">MelodyMap</div>
      <h1>Something went wrong</h1>
      <p>The page couldn't load. Your music library is safe — try reloading or go back home.</p>
      <div class="detail">
        <strong>Error:</strong> ${errorMessage.replace(/</g, "&lt;")}<br/>
        <strong>Time:</strong> ${timestamp}
      </div>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
