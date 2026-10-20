import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { ErrorBoundary } from './App';
import { loadJackDemo, localDemoAvailable } from './lib/demo';
import './styles.css';
import './themes.css';
import './personalisation.css';
import './practice.css';
const root = createRoot(document.getElementById('root')!);
async function start() {
  const url = new URL(location.href);
  if (localDemoAvailable() && url.searchParams.get('demo') === 'jack') {
    root.render(
      <main className="fatal-error">
        <h1>Loading Jack’s demo data</h1>
        <p role="status">Preparing six months of sample history and saving a recovery snapshot…</p>
      </main>,
    );
    try {
      await loadJackDemo();
      url.searchParams.delete('demo');
      url.hash = '/today';
      history.replaceState(null, '', url);
    } catch (error) {
      root.render(
        <main className="fatal-error">
          <h1>Demo data could not be loaded</h1>
          <p>{error instanceof Error ? error.message : String(error)}</p>
          <p>Your existing records are preserved.</p>
          <a href={url.pathname + '#/settings'}>Open Settings & data</a>
        </main>,
      );
      return;
    }
  }
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
void start();
