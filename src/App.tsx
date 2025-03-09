import './App.css'
import BaseLayout from './layout';
import { BrowserRouter } from 'react-router-dom';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    document.title = 'Talisman';
  }, []);

  return (
    <BrowserRouter>
      <BaseLayout />
    </BrowserRouter>
  )
}

export default App
