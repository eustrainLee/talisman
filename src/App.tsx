import './App.css'
import BaseLayout from './layout';
import { BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <BaseLayout />
    </BrowserRouter>
  )
}

export default App
