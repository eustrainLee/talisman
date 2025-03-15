import BaseLayout from './layout';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    document.title = 'Talisman';
  }, []);

  return <BaseLayout />;
}

export default App;
